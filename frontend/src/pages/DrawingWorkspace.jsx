import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ZoomIn,
  ZoomOut,
  Save,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Wand2,
  Eraser,
  Loader2,
  Plus,
  Table2
} from 'lucide-react';

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createWorker } from 'tesseract.js';

import api from '../services/api';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export default function DrawingWorkspace() {
  const { id } = useParams();

  const canvasRef = useRef(null);
  const pdfContainerRef = useRef(null);

  // Used for dragging balloons
  const dragBalloonRef = useRef(null);

  const [project, setProject] = useState(null);
  const [drawings, setDrawings] = useState([]);
  const [selectedDrawingId, setSelectedDrawingId] = useState(null);

  const [balloons, setBalloons] = useState([]);
  const [characteristics, setCharacteristics] = useState([]);

  const [mode, setMode] = useState('none');
  const [selectedBalloonId, setSelectedBalloonId] = useState(null);

  const [zoom, setZoom] = useState(1);
  const [renderScale, setRenderScale] = useState(1);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(1);

  const [pdfDocument, setPdfDocument] = useState(null);
  const [pdfPage, setPdfPage] = useState(null);

  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);

  const [activeDrawingMenuId, setActiveDrawingMenuId] = useState(null);
  const [confirmDeleteDrawingId, setConfirmDeleteDrawingId] =
    useState(null);

  const [drawingError, setDrawingError] = useState(false);
  const [autoDetecting, setAutoDetecting] = useState(false);

  const [savingUnitId, setSavingUnitId] = useState(null);
  const [savingCharacteristicId, setSavingCharacteristicId] = useState(null);
  const [showCharacteristicsTable, setShowCharacteristicsTable] = useState(false);

  // Editable right-panel balloon form
  const [currentBalloonNo, setCurrentBalloonNo] = useState('');
  const [editData, setEditData] = useState(null);

  const apiBase =
    import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const backendBase = apiBase.replace(/\/api\/?$/, '');

  /* =========================================================
     DRAWING URL
  ========================================================= */

  const drawingUrlFor = (drawingItem) => {
    if (!drawingItem) return null;

    let pathValue = drawingItem.url || drawingItem.filePath;

    if (!pathValue) return null;

    if (pathValue.startsWith('http')) {
      return pathValue;
    }

    if (!pathValue.startsWith('/')) {
      pathValue = `/${pathValue}`;
    }

    return `${backendBase}${pathValue}`;
  };

  /* =========================================================
     LOAD DATA
  ========================================================= */

  const loadData = async () => {
    try {
      const projectData = await api.get(`/projects/${id}`);
      setProject(projectData);

      const drawingsData = await api
        .get(`/projects/${id}/drawings`)
        .catch(async () => {
          const single = await api
            .get(`/projects/${id}/drawing`)
            .catch(() => null);

          return single ? [single] : [];
        });

      const normalizedDrawings = drawingsData.map((drawing) => ({
        ...drawing,
        url: drawing.filePath || drawing.url
      }));

      setDrawings(normalizedDrawings);

      setSelectedDrawingId((current) => {
        if (
          current &&
          normalizedDrawings.some(
            (item) => item._id === current
          )
        ) {
          return current;
        }

        return normalizedDrawings.length > 0
          ? normalizedDrawings[0]._id
          : null;
      });

      const balloonData = await api
        .get(`/projects/${id}/balloons`)
        .catch(() => []);

      setBalloons(balloonData);

      const characteristicData = await api
        .get(`/projects/${id}/characteristics`)
        .catch(() => []);

      setCharacteristics(characteristicData);
    } catch (error) {
      console.error(error);
      setMessage('Unable to load project');
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  /* =========================================================
     SELECTED DRAWING
  ========================================================= */

  const selectedDrawing = useMemo(
    () =>
      drawings.find(
        (drawingItem) =>
          drawingItem._id === selectedDrawingId
      ) || null,
    [drawings, selectedDrawingId]
  );

  const drawingUrl = drawingUrlFor(selectedDrawing);

  const isPdf =
    selectedDrawing?.filePath
      ?.toLowerCase()
      .endsWith('.pdf') ||
    selectedDrawing?.url
      ?.toLowerCase()
      .endsWith('.pdf') ||
    selectedDrawing?.fileName
      ?.toLowerCase()
      .endsWith('.pdf');

  /* =========================================================
     DISPLAY BALLOONS
  ========================================================= */

  const displayedBalloons = useMemo(() => {
    if (balloons.length > 0) {
      return balloons;
    }

    const seen = new Set();

    return characteristics.reduce((acc, entry) => {
      if (
        !entry.balloonId ||
        seen.has(entry.balloonId)
      ) {
        return acc;
      }

      seen.add(entry.balloonId);

      acc.push({
        _id: entry.balloonId,
        number: entry.number,
        x: entry.x,
        y: entry.y,
        anchorX: (entry.x || 0) + 25,
        anchorY: (entry.y || 0) + 25,
        text: entry.specification,
        type: entry.type,
        page: entry.page,
        status: entry.status || 'Draft'
      });

      return acc;
    }, []);
  }, [balloons, characteristics]);

  /* =========================================================
     LOAD PDF
  ========================================================= */

  useEffect(() => {
    if (
      !selectedDrawing ||
      !drawingUrl ||
      !isPdf
    ) {
      setPdfDocument(null);
      setPdfPage(null);
      setPageNumber(1);
      setPageCount(1);
      return;
    }

    let cancelled = false;

    const loadPdf = async () => {
      try {
        setLoadingPdf(true);
        setDrawingError(false);

        const loadingTask = pdfjsLib.getDocument({
          url: drawingUrl
        });

        const pdf = await loadingTask.promise;

        if (cancelled) return;

        setPdfDocument(pdf);
        setPageCount(pdf.numPages);
        setPageNumber(1);

        const page = await pdf.getPage(1);

        if (!cancelled) {
          setPdfPage(page);
        }
      } catch (error) {
        console.error(
          'PDF loading error:',
          error
        );

        if (!cancelled) {
          setDrawingError(true);
          setMessage(
            'Unable to display this PDF. Make sure the backend is running.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingPdf(false);
        }
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
    };
  }, [
    selectedDrawingId,
    drawingUrl,
    isPdf
  ]);

  /* =========================================================
     LOAD SELECTED PAGE
  ========================================================= */

  useEffect(() => {
    if (!pdfDocument) return;

    let cancelled = false;

    const loadPage = async () => {
      try {
        setLoadingPdf(true);

        const page =
          await pdfDocument.getPage(
            pageNumber
          );

        if (!cancelled) {
          setPdfPage(page);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) {
          setLoadingPdf(false);
        }
      }
    };

    loadPage();

    return () => {
      cancelled = true;
    };
  }, [pdfDocument, pageNumber]);

  /* =========================================================
     RENDER PDF
  ========================================================= */

  useEffect(() => {
    if (
      !pdfPage ||
      !canvasRef.current
    ) {
      return;
    }

    const canvas = canvasRef.current;
    const context =
      canvas.getContext('2d');

    const baseViewport =
      pdfPage.getViewport({
        scale: 1
      });

    const containerWidth =
      pdfContainerRef.current
        ?.clientWidth || 900;

    const fitScale =
      (containerWidth - 40) /
      baseViewport.width;

    const finalScale = Math.max(
      0.5,
      fitScale * zoom
    );

    const viewport =
      pdfPage.getViewport({
        scale: finalScale
      });

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    canvas.style.width =
      `${viewport.width}px`;

    canvas.style.height =
      `${viewport.height}px`;

    const renderContext = {
      canvasContext: context,
      viewport
    };

    pdfPage.render(renderContext);
  }, [pdfPage, zoom]);

  /* =========================================================
     SAVE PROJECT
  ========================================================= */

  const saveProject = async () => {
    try {
      setMessage('Saving...');

      await api.put(`/projects/${id}`, {
        status: 'Draft'
      });

      setMessage('Saved successfully');
    } catch (error) {
      setMessage(
        error.message || 'Save failed'
      );
    }
  };

  /* =========================================================
     MANUAL BALLOON
  ========================================================= */

  const createBalloon = async (event) => {
    if (mode !== 'manual') return;

    if (!pdfPage || !canvasRef.current) {
      return;
    }

    // Do not create a new balloon when clicking an existing balloon
    if (event.target.closest('.balloon-marker')) {
      return;
    }

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // IMPORTANT: x and y are calculated BEFORE they are used
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    // Place the balloon slightly above-left of where the user clicked,
    // and point the arrow at the clicked value on the drawing.
    const balloonX = Math.max(0, x - 28);
    const balloonY = Math.max(0, y - 28);

    // Find the highest existing balloon number
    let currentMaxNumber = 0;

    balloons.forEach((balloon) => {
      const number = Number(balloon.number);

      if (
        Number.isFinite(number) &&
        number > currentMaxNumber
      ) {
        currentMaxNumber = number;
      }
    });

    characteristics.forEach((characteristic) => {
      const number = Number(characteristic.number);

      if (
        Number.isFinite(number) &&
        number > currentMaxNumber
      ) {
        currentMaxNumber = number;
      }
    });

    // Generate the next balloon number
    const nextNumber = currentMaxNumber + 1;

    try {
      const balloon = await api.post(
        `/projects/${id}/balloons`,
        {
          x: balloonX,
          y: balloonY,
          anchorX: x,
          anchorY: y,
          text: 'New characteristic',
          type: 'Dimension',

          // IMPORTANT
          number: nextNumber,

          page: pageNumber,
          status: 'Draft'
        }
      );

      const characteristic = await api.post(
        `/projects/${id}/characteristics`,
        {
          balloonId: balloon._id,
          number: nextNumber,
          type: 'Dimension',
          value: '0',
          unit: 'mm',
          plusTolerance: '0.00',
          minusTolerance: '0.00',
          upperLimit: '0.00',
          lowerLimit: '0.00',
          specification: 'New characteristic',
          inspectionMethod: 'Vernier Caliper',
          instrument: '',
          actualValue: '',
          result: 'NOT INSPECTED',
          remarks: '',
          page: pageNumber,
          x: balloonX,
          y: balloonY,
          status: 'Draft'
        }
      );

      setBalloons((prev) => [
        ...prev,
        {
          ...balloon,

          // IMPORTANT
          number: nextNumber,

          x: balloonX,
          y: balloonY,
          page: pageNumber
        }
      ]);

      setCharacteristics((prev) => [
        ...prev,
        characteristic
      ]);

      setSelectedBalloonId(balloon._id);

      setMessage(
        `Balloon ${balloon.number} created`
      );

    } catch (error) {
      console.error(
        'Manual balloon creation failed:',
        error
      );

      setMessage(
        error.message ||
        'Unable to create balloon'
      );
    }
  };
  /* =========================================================
     DELETE SINGLE BALLOON
  ========================================================= */

  const deleteBalloon = async (
    balloonId
  ) => {
    if (!balloonId) {
      setMessage(
        'Select a balloon first'
      );
      return;
    }

    try {
      await api.delete(
        `/balloons/${balloonId}`
      );

      // Renumber the remaining balloons sequentially (1, 2, 3, ...),
      // so deleting a balloon shifts every following one down by one.
      const remaining = balloons
        .filter(
          (item) =>
            item._id !== balloonId
        )
        .sort(
          (a, b) =>
            (a.number ?? 0) -
            (b.number ?? 0)
        );

      const numberByBalloonId = {};

      remaining.forEach(
        (balloon, index) => {
          numberByBalloonId[
            balloon._id
          ] = index + 1;
        }
      );

      for (
        let index = 0;
        index < remaining.length;
        index += 1
      ) {
        const balloon =
          remaining[index];
        const newNumber =
          index + 1;

        if (
          balloon.number ===
          newNumber
        ) {
          continue;
        }

        try {
          await api.put(
            `/balloons/${balloon._id}`,
            { number: newNumber }
          );
        } catch (error) {
          console.error(
            'Failed to renumber balloon',
            balloon._id,
            error
          );
        }

        const characteristic =
          characteristics.find(
            (item) =>
              item.balloonId ===
              balloon._id
          );

        if (characteristic) {
          try {
            await api.put(
              `/characteristics/${characteristic._id}`,
              { number: newNumber }
            );
          } catch (error) {
            console.error(
              'Failed to renumber characteristic',
              characteristic._id,
              error
            );
          }
        }
      }

      setBalloons((prev) =>
        prev
          .filter(
            (item) =>
              item._id !== balloonId
          )
          .map((item) => ({
            ...item,
            number:
              numberByBalloonId[
                item._id
              ] ?? item.number
          }))
      );

      setCharacteristics((prev) =>
        prev
          .filter(
            (item) =>
              item.balloonId !==
              balloonId
          )
          .map((item) => ({
            ...item,
            number:
              numberByBalloonId[
                item.balloonId
              ] ?? item.number
          }))
      );

      setSelectedBalloonId(null);
      setEditData(null);
      setCurrentBalloonNo('');

      setMessage(
        'Balloon removed and balloons renumbered'
      );
    } catch (error) {
      setMessage(
        error.message ||
        'Failed to remove balloon'
      );
    }
  };

  /* =========================================================
     CLEAR ALL BALLOONING
  ========================================================= */

  const clearAllBallooning = async () => {
    if (
      balloons.length === 0 &&
      characteristics.length === 0
    ) {
      setMessage(
        'There are no balloons to clear'
      );
      return;
    }

    const confirmed =
      window.confirm(
        'Are you sure you want to clear ALL ballooning? This will remove all balloons and characteristics from this project.'
      );

    if (!confirmed) {
      return;
    }

    try {
      setMessage(
        'Clearing all ballooning...'
      );

      /*
        Delete every balloon.

        Your existing backend already has:
        DELETE /balloons/:balloonId
      */

      const uniqueBalloonIds = [
        ...new Set(
          balloons
            .map((item) => item._id)
            .filter(Boolean)
        )
      ];

      for (
        const balloonId of
        uniqueBalloonIds
      ) {
        try {
          await api.delete(
            `/balloons/${balloonId}`
          );
        } catch (error) {
          console.error(
            `Failed to delete balloon ${balloonId}`,
            error
          );
        }
      }

      /*
        Clear frontend state.
      */

      setBalloons([]);
      setCharacteristics([]);
      setSelectedBalloonId(null);

      setMessage(
        'All ballooning has been cleared'
      );
    } catch (error) {
      console.error(error);

      setMessage(
        error.message ||
        'Failed to clear ballooning'
      );
    }
  };

  /* =========================================================
     UPDATE UNIT
  ========================================================= */

  const updateUnit = async (
    characteristicId,
    newUnit
  ) => {
    const unit =
      newUnit.trim();

    if (!unit) {
      setMessage(
        'Please enter a unit'
      );
      return;
    }

    try {
      setSavingUnitId(
        characteristicId
      );

      /*
        Immediately update screen.
      */

      setCharacteristics((prev) =>
        prev.map((item) =>
          item._id ===
            characteristicId
            ? {
              ...item,
              unit
            }
            : item
        )
      );

      /*
        Save to backend.
      */

      const updated =
        await api.put(
          `/characteristics/${characteristicId}`,
          {
            unit
          }
        );

      /*
        If backend returns updated
        characteristic, use it.
      */

      if (updated) {
        setCharacteristics((prev) =>
          prev.map((item) =>
            item._id ===
              characteristicId
              ? {
                ...item,
                ...updated
              }
              : item
          )
        );
      }

      setMessage(
        `Unit changed to "${unit}"`
      );
    } catch (error) {
      console.error(error);

      setMessage(
        error.message ||
        'Failed to save unit'
      );

      /*
        Reload data in case backend
        rejected the update.
      */

      loadData();
    } finally {
      setSavingUnitId(null);
    }
  };

  /* =========================================================
     BALLOON EDIT PANEL (right side)
  ========================================================= */

  const syncEditFromBalloon = (balloonId) => {
    const characteristic = characteristics.find(
      (item) => item.balloonId === balloonId
    );

    if (!characteristic) return;

    setCurrentBalloonNo(String(characteristic.number ?? ''));
    setEditData({
      characteristicId: characteristic._id,
      balloonId: characteristic.balloonId,
      number: String(characteristic.number ?? ''),
      specification: characteristic.specification || '',
      value: characteristic.value || '',
      plusTolerance: characteristic.plusTolerance || '',
      minusTolerance: characteristic.minusTolerance || ''
    });
  };

  const loadCharacteristicByNumber = (rawNumber) => {
    const text = String(rawNumber ?? '').trim();

    if (!text) {
      setEditData(null);
      return;
    }

    const number = Number(text);

    if (!Number.isFinite(number)) return;

    const characteristic = characteristics.find(
      (item) => Number(item.number) === number
    );

    if (!characteristic) {
      setMessage(`No balloon with number ${number}`);
      return;
    }

    setSelectedBalloonId(characteristic.balloonId);
    syncEditFromBalloon(characteristic.balloonId);
    setMessage(`Balloon ${number} loaded`);
  };

  const handleBalloonNumberChange = (value) => {
    setCurrentBalloonNo(value);

    // Auto-load details only when nothing is currently being
    // edited, so an existing balloon's number can still be
    // changed freely.
    if (!editData) {
      loadCharacteristicByNumber(value);
    }
  };

  const handleBalloonNumberKeyDown = (event) => {
    if (event.key === 'Enter') {
      loadCharacteristicByNumber(currentBalloonNo);
    }
  };

  const saveEdit = async () => {
    if (!editData?.characteristicId) {
      setMessage('Enter a balloon number or select a balloon first');
      return;
    }

    try {
      setSavingCharacteristicId(editData.characteristicId);

      const number = Number(editData.number);

      const updated = await api.put(
        `/characteristics/${editData.characteristicId}`,
        {
          number,
          specification: editData.specification,
          value: editData.value,
          plusTolerance: editData.plusTolerance,
          minusTolerance: editData.minusTolerance
        }
      );

      // Keep the balloon number on the drawing in sync
      await api.put(
        `/balloons/${editData.balloonId}`,
        { number }
      );

      if (updated) {
        setCharacteristics((prev) =>
          prev.map((item) =>
            item._id === editData.characteristicId
              ? { ...item, ...updated }
              : item
          )
        );
      }

      setBalloons((prev) =>
        prev.map((item) =>
          item._id === editData.balloonId
            ? { ...item, number }
            : item
        )
      );

      setMessage('Balloon saved');
    } catch (error) {
      console.error('Failed to save balloon:', error);
      setMessage(error.message || 'Failed to save balloon');
    } finally {
      setSavingCharacteristicId(null);
    }
  };

  // Populate the edit panel when a balloon is clicked on the drawing
  useEffect(() => {
    if (selectedBalloonId) {
      syncEditFromBalloon(selectedBalloonId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBalloonId]);

  /* =========================================================
     DRAG BALLOON
  ========================================================= */

  const handleBalloonPointerDown = (
    event,
    balloon
  ) => {
    event.stopPropagation();

    if (!canvasRef.current) return;

    const canvas =
      canvasRef.current;

    const rect =
      canvas.getBoundingClientRect();

    setSelectedBalloonId(
      balloon._id
    );

    dragBalloonRef.current = {
      balloonId: balloon._id,
      offsetX:
        event.clientX -
        rect.left -
        balloon.x,
      offsetY:
        event.clientY -
        rect.top -
        balloon.y
    };

    event.currentTarget.setPointerCapture?.(
      event.pointerId
    );
  };

  const handleBalloonPointerMove = (
    event
  ) => {
    const drag =
      dragBalloonRef.current;

    if (!drag || !canvasRef.current) {
      return;
    }

    const canvas =
      canvasRef.current;

    const rect =
      canvas.getBoundingClientRect();

    let newX =
      event.clientX -
      rect.left -
      drag.offsetX;

    let newY =
      event.clientY -
      rect.top -
      drag.offsetY;

    // Keep balloon inside canvas
    newX = Math.max(
      0,
      Math.min(
        rect.width,
        newX
      )
    );

    newY = Math.max(
      0,
      Math.min(
        rect.height,
        newY
      )
    );

    setBalloons((prev) =>
      prev.map((balloon) =>
        balloon._id ===
          drag.balloonId
          ? {
            ...balloon,
            x: newX,
            y: newY
            /*
              The anchor stays at the
              value, so the arrow keeps
              pointing at it.
            */
          }
          : balloon
      )
    );
  };

  const handleBalloonPointerUp =
    async () => {
      const drag =
        dragBalloonRef.current;

      if (!drag) return;

      dragBalloonRef.current =
        null;

      const balloon =
        balloons.find(
          (item) =>
            item._id ===
            drag.balloonId
        );

      if (!balloon) return;

      try {
        /*
          When the balloon is dropped onto a
          measurement, re-read that value from
          the drawing and auto-fetch it into
          the characteristic table.
        */

        let fetchedDimension =
          null;

        try {
          fetchedDimension =
            await readDimensionAtPoint(
              balloon.x,
              balloon.y
            );
        } catch (readError) {
          console.error(
            'Failed to read dimension at drop point:',
            readError
          );
        }

        const characteristic =
          characteristics.find(
            (item) =>
              item.balloonId ===
              balloon._id
          );

        if (fetchedDimension) {
          const updatedBalloon =
            await api.put(
              `/balloons/${balloon._id}`,
              {
                x: balloon.x,
                y: balloon.y,

                /*
                  Re-anchor the arrow at the
                  new measurement.
                */

                anchorX:
                  fetchedDimension.centerX,

                anchorY:
                  fetchedDimension.centerY,

                text:
                  fetchedDimension.text,

                type:
                  fetchedDimension.type
              }
            );

          if (characteristic) {
            const updatedCharacteristic =
              await api.put(
                `/characteristics/${characteristic._id}`,
                {
                  type:
                    fetchedDimension.type,

                  value:
                    fetchedDimension.value,

                  plusTolerance:
                    fetchedDimension.plusTolerance,

                  minusTolerance:
                    fetchedDimension.minusTolerance,

                  upperLimit:
                    fetchedDimension.upperLimit,

                  lowerLimit:
                    fetchedDimension.lowerLimit,

                  specification:
                    fetchedDimension.specification,

                  x: balloon.x,
                  y: balloon.y
                }
              );

            setCharacteristics(
              (prev) =>
                prev.map((item) =>
                  item._id ===
                    characteristic._id
                    ? {
                      ...updatedCharacteristic
                    }
                    : item
                )
            );
          }

          setBalloons((prev) =>
            prev.map((item) =>
              item._id ===
                balloon._id
                ? {
                  ...item,
                  ...updatedBalloon
                }
                : item
            )
          );

          setMessage(
            `Balloon ${balloon.number}: ${fetchedDimension.specification} fetched into the characteristic table`
          );
        } else {
          await api.put(
            `/balloons/${balloon._id}`,
            {
              x: balloon.x,
              y: balloon.y
              /*
                The anchor (value position)
                is preserved so the arrow
                keeps pointing at it.
              */
            }
          );

          // Also update characteristic position
          if (characteristic) {
            setCharacteristics(
              (prev) =>
                prev.map((item) =>
                  item._id ===
                    characteristic._id
                    ? {
                      ...item,
                      x: balloon.x,
                      y: balloon.y
                    }
                    : item
                )
            );

            await api.put(
              `/characteristics/${characteristic._id}`,
              {
                x: balloon.x,
                y: balloon.y
              }
            );
          }

          setMessage(
            `Balloon ${balloon.number} moved`
          );
        }
      } catch (error) {
        console.error(
          'Failed to save balloon position:',
          error
        );

        setMessage(
          error.message ||
          'Failed to save balloon position'
        );
      }
    };

  /* =========================================================
     RE-READ DIMENSION AT A POINT
     When a balloon is dragged onto a measurement, the nearest
     value near the drop point is re-read from the PDF text
     layer and parsed the same way as Auto Detect, so the
     characteristic table gets the value automatically.
  ========================================================= */

  const readDimensionAtPoint = async (
    pointX,
    pointY
  ) => {
    if (!pdfPage) {
      return null;
    }

    const baseViewport =
      pdfPage.getViewport({
        scale: 1
      });

    let displayScale = 1;

    if (canvasRef.current) {
      displayScale =
        canvasRef.current.width /
        baseViewport.width;
    }

    const normalizeText = (value) =>
      String(value || '')
        .replace(/[−–—]/g, '-')
        .replace(/[＋]/g, '+')
        .replace(/[Øø]/g, 'Ø')
        .replace(/\s+/g, ' ')
        .trim();

    const tolerancePattern =
      /^\s*(?:Ø\s*)?\d+(?:\.\d+)?\s*±\s*\d+(?:\.\d+)?\s*$/i;

    const bilateralTolerancePattern =
      /^\s*(?:Ø\s*)?\d+(?:\.\d+)?\s*[+＋]\s*\d+(?:\.\d+)?\s*\/\s*[-−]\s*\d+(?:\.\d+)?\s*$/i;

    const diameterPattern =
      /^\s*Ø\s*\d+(?:\.\d+)?\s*$/i;

    const radiusPattern =
      /^\s*R\s*\d+(?:\.\d+)?\s*$/i;

    const dimensionPattern =
      /^\s*\d{1,3}(?:\.\d{1,4})?(?:\s*(?:mm|in|inch|inches))?\s*$/i;

    const smallTolerancePattern =
      /^\s*[+-]?\s*0?\.\d{1,3}\s*$/;

    const isCharacteristicText = (
      rawText
    ) => {
      const text =
        normalizeText(rawText);

      if (!text) {
        return false;
      }

      if (
        /^(A[0-4]|REV|DATE|DESCRIPTION|WEIGHT|SHEET|SCALE)$/i.test(
          text
        )
      ) {
        return false;
      }

      if (
        /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$/.test(
          text
        )
      ) {
        return false;
      }

      if (
        /\d+[-_/]\d+[-_/]\d+/.test(text)
      ) {
        return false;
      }

      if (/^\d{4,}$/.test(text)) {
        return false;
      }

      return (
        tolerancePattern.test(text) ||
        bilateralTolerancePattern.test(
          text
        ) ||
        diameterPattern.test(text) ||
        radiusPattern.test(text) ||
        dimensionPattern.test(text) ||
        smallTolerancePattern.test(text)
      );
    };

    const textContent =
      await pdfPage.getTextContent();

    const items = [];

    for (
      const item of textContent.items
    ) {
      if (
        !item.str ||
        !item.str.trim()
      ) {
        continue;
      }

      const text =
        normalizeText(item.str);

      if (
        !isCharacteristicText(text)
      ) {
        continue;
      }

      const point =
        baseViewport.convertToViewportPoint(
          item.transform?.[4] || 0,
          item.transform?.[5] || 0
        );

      if (
        point[1] >
        baseViewport.height * 0.87
      ) {
        continue;
      }

      if (
        point[0] >
          baseViewport.width * 0.68 &&
        point[1] <
        baseViewport.height * 0.12
      ) {
        continue;
      }

      items.push({
        text,

        x:
          point[0] * displayScale,

        y:
          point[1] * displayScale,

        width:
          Number(item.width || 0) *
          displayScale,

        height:
          Number(item.height || 0) *
          displayScale,

        source: 'pdf'
      });
    }

    if (items.length === 0) {
      return null;
    }

    /*
      PDF text y is the BASELINE (bottom of the
      text), so the visual center is y - h/2.
    */

    const centerX = (item) =>
      item.x + (item.width || 0) / 2;

    const centerY = (item) =>
      item.y - (item.height || 0) / 2;

    let nearest = null;
    let nearestDistance = Infinity;

    for (const item of items) {
      const dx =
        centerX(item) - pointX;

      const dy =
        centerY(item) - pointY;

      const distance = Math.sqrt(
        dx * dx + dy * dy
      );

      if (
        distance < nearestDistance
      ) {
        nearestDistance = distance;
        nearest = item;
      }
    }

    /*
      Only reassign when the balloon is dropped
      close enough to a measurement.
    */

    if (
      !nearest ||
      nearestDistance > 150
    ) {
      return null;
    }

    const text = nearest.text;

    let plusTolerance = '0.00';
    let minusTolerance = '0.00';
    let cleanedValue = text;

    const plusMinusMatch =
      text.match(
        /^\s*(?:Ø\s*)?(\d+(?:\.\d+)?)\s*±\s*(\d+(?:\.\d+)?)/i
      );

    const bilateralMatch =
      text.match(
        /^\s*(?:Ø\s*)?(\d+(?:\.\d+)?)\s*\+(\d+(?:\.\d+)?)\s*\/\s*-(\d+(?:\.\d+)?)/i
      );

    if (plusMinusMatch) {
      cleanedValue =
        plusMinusMatch[1];

      plusTolerance =
        plusMinusMatch[2];

      minusTolerance =
        plusMinusMatch[2];
    }

    if (bilateralMatch) {
      cleanedValue =
        bilateralMatch[1];

      plusTolerance =
        bilateralMatch[2];

      minusTolerance =
        bilateralMatch[3];
    }

    const diameterMatch =
      text.match(
        /Ø\s*(\d+(?:\.\d+)?)/i
      );

    if (
      diameterMatch &&
      !plusMinusMatch &&
      !bilateralMatch
    ) {
      cleanedValue =
        diameterMatch[1];
    }

    const radiusMatch =
      text.match(/R\s*(\d+(?:\.\d+)?)/i);

    if (
      radiusMatch &&
      !plusMinusMatch &&
      !bilateralMatch
    ) {
      cleanedValue = radiusMatch[1];
    }

    const numericMatch =
      text.match(
        /^\s*(\d+(?:\.\d+)?)\s*(?:mm|in|inch|inches)?\s*$/i
      );

    if (
      numericMatch &&
      !plusMinusMatch &&
      !bilateralMatch
    ) {
      cleanedValue = numericMatch[1];
    }

    /*
      Combine a standalone tolerance that sits
      right next to the value (16 / 0.05 / 0.03).
    */

    if (
      !plusMinusMatch &&
      !bilateralMatch
    ) {
      const standaloneTolerances =
        items.filter(
          (item) =>
            smallTolerancePattern.test(
              item.text
            )
        );

      const isNearbyTolerance = (
        dimension,
        tolerance
      ) => {
        const dimensionCenterX =
          dimension.x +
          (dimension.width || 0) /
            2;

        const toleranceCenterX =
          tolerance.x +
          (tolerance.width || 0) / 2;

        const xDifference =
          Math.abs(
            dimensionCenterX -
            toleranceCenterX
          );

        const yDifference =
          Math.abs(
            dimension.y -
            tolerance.y
          );

        const maxXDistance =
          Math.max(
            45,
            (dimension.width || 20) *
              2.5
          );

        const maxYDistance =
          Math.max(
            60,
            (dimension.height || 12) *
              4
          );

        return (
          xDifference <=
            maxXDistance &&
          yDifference <= maxYDistance
        );
      };

      const nearby = standaloneTolerances
        .filter((tolerance) =>
          isNearbyTolerance(
            nearest,
            tolerance
          )
        )
        .sort(
          (a, b) => a.y - b.y
        )
        .slice(0, 2);

      const getToleranceNumber = (
        toleranceText
      ) => {
        const match =
          normalizeText(
            toleranceText
          ).match(
            /[+-]?\s*(0?\.\d{1,3})/
          );

        return match
          ? Number(match[1])
          : null;
      };

      if (nearby.length === 1) {
        const toleranceValue =
          getToleranceNumber(
            nearby[0].text
          );

        if (
          Number.isFinite(
            toleranceValue
          )
        ) {
          plusTolerance =
            toleranceValue.toFixed(3);

          minusTolerance =
            toleranceValue.toFixed(3);
        }
      }

      if (nearby.length >= 2) {
        const firstValue =
          getToleranceNumber(
            nearby[0].text
          );

        const secondValue =
          getToleranceNumber(
            nearby[1].text
          );

        if (
          Number.isFinite(
            firstValue
          ) &&
          Number.isFinite(
            secondValue
          )
        ) {
          const firstHasPlus =
            /^\+/.test(
              normalizeText(
                nearby[0].text
              )
            );

          const firstHasMinus =
            /^-/.test(
              normalizeText(
                nearby[0].text
              )
            );

          const secondHasPlus =
            /^\+/.test(
              normalizeText(
                nearby[1].text
              )
            );

          const secondHasMinus =
            /^-/.test(
              normalizeText(
                nearby[1].text
              )
            );

          if (
            firstHasPlus &&
            secondHasMinus
          ) {
            plusTolerance =
              firstValue.toFixed(3);

            minusTolerance =
              secondValue.toFixed(3);
          } else if (
            firstHasMinus &&
            secondHasPlus
          ) {
            plusTolerance =
              secondValue.toFixed(3);

            minusTolerance =
              firstValue.toFixed(3);
          } else {
            plusTolerance =
              firstValue.toFixed(3);

            minusTolerance =
              secondValue.toFixed(3);
          }
        }
      }
    }

    let type = 'Dimension';

    if (
      diameterPattern.test(text)
    ) {
      type = 'Diameter';
    } else if (
      radiusPattern.test(text)
    ) {
      type = 'Radius';
    }

    const value = cleanedValue;

    const numericValue =
      Number(value);

    const plus = Number(
      plusTolerance
    );

    const minus = Number(
      minusTolerance
    );

    let upperLimit = '0.00';
    let lowerLimit = '0.00';

    if (
      Number.isFinite(numericValue)
    ) {
      upperLimit = (
        numericValue +
        (Number.isFinite(plus)
          ? plus
          : 0)
      ).toFixed(3);

      lowerLimit = (
        numericValue -
        (Number.isFinite(minus)
          ? minus
          : 0)
      ).toFixed(3);
    }

    let specification = text;

    if (
      plusTolerance !== '0.00' ||
      minusTolerance !== '0.00'
    ) {
      specification =
        plusTolerance ===
        minusTolerance
          ? `${value} ±${plusTolerance}`
          : `${value} +${plusTolerance}/-${minusTolerance}`;
    }

    return {
      text,

      value,

      type,

      plusTolerance,

      minusTolerance,

      upperLimit,

      lowerLimit,

      specification,

      centerX: centerX(nearest),

      centerY: centerY(nearest)
    };
  };

  /* =========================================================
     UPLOAD DRAWING
  ========================================================= */

  const uploadDrawing = async (
    event
  ) => {
    const selected =
      event.target.files?.[0];

    if (!selected) return;

    if (
      !selected.name
        .toLowerCase()
        .endsWith('.pdf') &&
      !selected.type.includes('pdf')
    ) {
      setMessage(
        'Please select a PDF drawing'
      );
      return;
    }

    try {
      setUploading(true);
      setMessage(
        'Uploading drawing...'
      );

      const formData =
        new FormData();

      formData.append(
        'drawing',
        selected
      );

      const data =
        await api.upload(
          `/projects/${id}/drawing`,
          formData
        );

      const drawingEntry = {
        ...data,
        url:
          data.filePath ||
          data.url
      };

      setDrawings((prev) => [
        drawingEntry,
        ...prev
      ]);

      setSelectedDrawingId(
        drawingEntry._id
      );

      setMessage(
        'Drawing uploaded successfully'
      );
    } catch (error) {
      console.error(error);

      setMessage(
        error.message ||
        'Drawing upload failed'
      );
    } finally {
      setUploading(false);

      event.target.value = '';
    }
  };

  /* =========================================================
     DELETE DRAWING
  ========================================================= */

  const deleteDrawing = async (
    drawingId
  ) => {
    if (!drawingId) return;

    try {
      await api.delete(
        `/projects/${id}/drawings/${drawingId}`
      );

      setDrawings((prev) => {
        const remaining =
          prev.filter(
            (item) =>
              item._id !== drawingId
          );

        if (
          selectedDrawingId ===
          drawingId
        ) {
          setSelectedDrawingId(
            remaining.length > 0
              ? remaining[0]._id
              : null
          );
        }

        return remaining;
      });

      setConfirmDeleteDrawingId(
        null
      );

      setActiveDrawingMenuId(
        null
      );

      setMessage(
        'Drawing deleted'
      );
    } catch (error) {
      setMessage(
        error.message ||
        'Failed to delete drawing'
      );
    }
  };

  /* =========================================================
     RENAME DRAWING
  ========================================================= */

  const renameDrawing = async (
    drawingId,
    newName
  ) => {
    if (
      !drawingId ||
      !newName
    ) {
      return;
    }

    try {
      const updated =
        await api.put(
          `/projects/${id}/drawings/${drawingId}`,
          {
            fileName: newName
          }
        );

      setDrawings((prev) =>
        prev.map((item) =>
          item._id ===
            updated._id
            ? {
              ...updated,
              url:
                updated.filePath ||
                updated.url
            }
            : item
        )
      );

      setActiveDrawingMenuId(
        null
      );

      setMessage(
        'Drawing renamed'
      );
    } catch (error) {
      setMessage(
        error.message ||
        'Rename failed'
      );
    }
  };

  /* =========================================================
     PAGE NAVIGATION
  ========================================================= */

  const previousPage = () => {
    setPageNumber((page) =>
      Math.max(1, page - 1)
    );
  };

  const nextPage = () => {
    setPageNumber((page) =>
      Math.min(
        pageCount,
        page + 1
      )
    );
  };

  /* =========================================================
   SMART DETECTION CLEANUP
   ---------------------------------------------------------
   Removes duplicate readings and joins nearby tolerance
   text with its parent dimension.
========================================================= */

  const cleanAndGroupDetections = (detections) => {
    if (!detections || detections.length === 0) {
      return [];
    }

    const normalize = (value) =>
      String(value || '')
        .replace(/[−–—]/g, '-')
        .replace(/[＋]/g, '+')
        .replace(/[Øø]/g, 'Ø')
        .replace(/\s+/g, ' ')
        .trim();

    const getNumber = (text) => {
      const match = normalize(text).match(
        /(?:Ø\s*|R\s*)?(\d+(?:\.\d+)?)/i
      );

      return match ? match[1] : null;
    };

    const isToleranceOnly = (text) => {
      const value = normalize(text);

      return (
        /^±\s*\d+(?:\.\d+)?$/i.test(value) ||
        /^[+]\s*\d+(?:\.\d+)?\s*\/\s*[-]\s*\d+(?:\.\d+)?$/i.test(value) ||
        /^0?\.\d{1,3}$/i.test(value)
      );
    };

    const isFullTolerance = (text) => {
      const value = normalize(text);

      return (
        /^\d+(?:\.\d+)?\s*±\s*\d+(?:\.\d+)?$/i.test(value) ||
        /^\d+(?:\.\d+)?\s*[+]\s*\d+(?:\.\d+)?\s*\/\s*[-]\s*\d+(?:\.\d+)?$/i.test(value)
      );
    };

    const isDimension = (text) => {
      const value = normalize(text);

      return (
        /^Ø\s*\d+(?:\.\d+)?$/i.test(value) ||
        /^R\s*\d+(?:\.\d+)?$/i.test(value) ||
        /^\d+(?:\.\d+)?(?:\s*(?:mm|in|inch|inches))?$/i.test(value)
      );
    };

    const center = (item) => ({
      x:
        Number(item.x || 0) +
        Number(item.width || 0) / 2,

      y:
        Number(item.y || 0) +
        Number(item.height || 0) / 2
    });

    const distance = (a, b) => {
      const ca = center(a);
      const cb = center(b);

      return Math.sqrt(
        Math.pow(ca.x - cb.x, 2) +
        Math.pow(ca.y - cb.y, 2)
      );
    };

    const sameLocation = (a, b) => {
      const d = distance(a, b);

      const sizeA = Math.max(
        Number(a.width || 0),
        Number(a.height || 0),
        10
      );

      const sizeB = Math.max(
        Number(b.width || 0),
        Number(b.height || 0),
        10
      );

      return d <= Math.max(12, Math.min(sizeA, sizeB) * 1.8);
    };

    /*
       STEP 1
       Normalize all text.
    */

    const normalized = detections
      .map((item) => ({
        ...item,
        text: normalize(item.text)
      }))
      .filter((item) => item.text);

    /*
       STEP 2
       Remove exact duplicate readings that are
       physically at the same location.
    */

    const unique = [];

    for (const item of normalized) {
      const duplicate = unique.some((existing) => {
        return (
          normalize(existing.text) ===
          normalize(item.text) &&
          sameLocation(existing, item)
        );
      });

      if (!duplicate) {
        unique.push(item);
      }
    }

    /*
       STEP 3
       Join tolerance-only text with the nearest
       dimension.
  
       Example:
  
         25
         ±0.05
  
       becomes:
  
         25 ±0.05
  
       Instead of two balloons.
    */

    const used = new Set();
    const grouped = [];

    for (let i = 0; i < unique.length; i++) {
      if (used.has(i)) {
        continue;
      }

      const current = unique[i];

      /*
         If this is already a complete reading,
         keep it as one characteristic.
      */

      if (isFullTolerance(current.text)) {
        grouped.push(current);
        used.add(i);
        continue;
      }

      /*
         If this is a normal dimension, search
         for a nearby tolerance.
      */

      if (isDimension(current.text)) {
        let bestToleranceIndex = -1;
        let bestDistance = Infinity;

        for (let j = 0; j < unique.length; j++) {
          if (i === j || used.has(j)) {
            continue;
          }

          const candidate = unique[j];

          if (!isToleranceOnly(candidate.text)) {
            continue;
          }

          const d = distance(
            current,
            candidate
          );

          /*
             Tolerance should be physically close
             to the dimension.
  
             The 45px value is deliberately limited
             so unrelated dimensions don't merge.
          */

          if (d < 45 && d < bestDistance) {
            bestDistance = d;
            bestToleranceIndex = j;
          }
        }

        if (bestToleranceIndex !== -1) {
          const tolerance =
            unique[bestToleranceIndex];

          let toleranceText =
            normalize(tolerance.text);

          /*
             Convert:
  
             0.02
  
             into:
  
             ±0.02
  
             ONLY when it is clearly attached
             to a dimension.
          */

          if (
            /^0?\.\d{1,3}$/i.test(
              toleranceText
            )
          ) {
            toleranceText =
              `±${toleranceText}`;
          }

          grouped.push({
            ...current,

            text:
              `${current.text} ${toleranceText}`,

            width:
              Math.max(
                Number(current.width || 0),
                Number(tolerance.width || 0)
              ),

            height:
              Math.max(
                Number(current.height || 0),
                Number(tolerance.height || 0)
              )
          });

          used.add(i);
          used.add(bestToleranceIndex);

          continue;
        }
      }

      /*
         Otherwise keep the original detection.
      */

      grouped.push(current);
      used.add(i);
    }

    /*
       STEP 4
       Final safety check.
  
       Never allow two characteristics to
       occupy essentially the same location.
    */

    const finalResult = [];

    for (const item of grouped) {
      const duplicate = finalResult.some(
        (existing) => {
          if (
            normalize(existing.text) ===
            normalize(item.text)
          ) {
            return sameLocation(
              existing,
              item
            );
          }

          /*
             If two different OCR readings are
             almost exactly on top of each other,
             keep only one.
          */

          return distance(
            existing,
            item
          ) < 8;
        }
      );

      if (!duplicate) {
        finalResult.push(item);
      }
    }

    return finalResult;
  };

  /* =========================================================
   AUTO DETECTION
   Detect engineering dimensions + grouped tolerances

   SUPPORTED:
   ---------------------------------------------------------
   1. 25
   2. Ø20
   3. R10
   4. 25 ±0.05
   5. 25 +0.05/-0.03
   6. 25
        +0.05
        -0.03

   IMPORTANT:
   Nearby tolerance values are grouped with the
   main dimension and DO NOT create separate balloons.
========================================================= */

  const autoDetect = async () => {
    if (!pdfPage) {
      setMessage('Please upload a PDF first');
      return;
    }

    try {
      setAutoDetecting(true);
      setMode('auto');

      setMessage('Analyzing engineering drawing...');

      /* =========================================================
         1. PDF PAGE INFORMATION
      ========================================================= */

      const baseViewport = pdfPage.getViewport({
        scale: 1
      });

      let displayScale = 1;

      if (canvasRef.current) {
        displayScale =
          canvasRef.current.width /
          baseViewport.width;
      }

      /* =========================================================
         2. DETECTION REGEX
      ========================================================= */

      const tolerancePattern =
        /^\s*(?:Ø\s*)?\d+(?:\.\d+)?\s*±\s*\d+(?:\.\d+)?\s*$/i;

      const bilateralTolerancePattern =
        /^\s*(?:Ø\s*)?\d+(?:\.\d+)?\s*[+＋]\s*\d+(?:\.\d+)?\s*\/\s*[-−]\s*\d+(?:\.\d+)?\s*$/i;

      const diameterPattern =
        /^\s*Ø\s*\d+(?:\.\d+)?\s*$/i;

      const radiusPattern =
        /^\s*R\s*\d+(?:\.\d+)?\s*$/i;

      const dimensionPattern =
        /^\s*\d{1,3}(?:\.\d{1,4})?(?:\s*(?:mm|in|inch|inches))?\s*$/i;

      /*
        Standalone small tolerance.
  
        Examples:
        0.02
        0.03
        0.05
        0.10
        +0.05
        -0.03
      */
      const smallTolerancePattern =
        /^\s*[+-]?\s*0?\.\d{1,3}\s*$/;

      /* =========================================================
         3. NORMALIZE TEXT
      ========================================================= */

      const normalizeText = (value) => {
        return String(value || '')
          .replace(/[−–—]/g, '-')
          .replace(/[＋]/g, '+')
          .replace(/[Øø]/g, 'Ø')
          .replace(/\s+/g, ' ')
          .trim();
      };

      /* =========================================================
         4. CHARACTERISTIC CHECK
      ========================================================= */

      const isCharacteristicText = (rawText) => {
        const text = normalizeText(rawText);

        if (!text) {
          return false;
        }

        /*
          Ignore obvious non-dimension text.
        */

        if (
          /^(A[0-4]|REV|DATE|DESCRIPTION|WEIGHT|SHEET|SCALE)$/i.test(
            text
          )
        ) {
          return false;
        }

        /*
          Ignore dates.
        */

        if (
          /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$/.test(
            text
          )
        ) {
          return false;
        }

        /*
          Ignore drawing / part numbers.
        */

        if (
          /\d+[-_/]\d+[-_/]\d+/.test(text)
        ) {
          return false;
        }

        /*
          Ignore long numbers.
        */

        if (
          /^\d{4,}$/.test(text)
        ) {
          return false;
        }

        /*
          Accept engineering characteristics.
        */

        if (
          tolerancePattern.test(text) ||
          bilateralTolerancePattern.test(text) ||
          diameterPattern.test(text) ||
          radiusPattern.test(text) ||
          dimensionPattern.test(text) ||
          smallTolerancePattern.test(text)
        ) {
          return true;
        }

        return false;
      };

      /* =========================================================
         5. READ SELECTABLE PDF TEXT
      ========================================================= */

      const textContent =
        await pdfPage.getTextContent();

      const detected = [];

      for (
        const item of textContent.items
      ) {
        if (
          !item.str ||
          !item.str.trim()
        ) {
          continue;
        }

        const text =
          normalizeText(item.str);

        if (
          !isCharacteristicText(text)
        ) {
          continue;
        }

        const pdfX =
          item.transform?.[4] || 0;

        const pdfY =
          item.transform?.[5] || 0;

        const point =
          baseViewport.convertToViewportPoint(
            pdfX,
            pdfY
          );

        const x =
          point[0] * displayScale;

        const y =
          point[1] * displayScale;

        /*
          Ignore title block.
        */

        if (
          point[1] >
          baseViewport.height * 0.87
        ) {
          continue;
        }

        /*
          Ignore top-right revision area.
        */

        if (
          point[0] >
          baseViewport.width * 0.68 &&
          point[1] <
          baseViewport.height * 0.12
        ) {
          continue;
        }

        detected.push({
          text,
          x,
          y,

          width:
            Number(item.width || 0) *
            displayScale,

          height:
            Number(item.height || 0) *
            displayScale,

          confidence: 1,

          source: 'pdf'
        });
      }

      /* =========================================================
         6. REMOVE DUPLICATE / OVERLAPPING DETECTIONS
      ========================================================= */

      const uniqueDetected =
        cleanAndGroupDetections(
          detected
        );

      /* =========================================================
         7. OCR FALLBACK
      ========================================================= */

      let finalDetected =
        uniqueDetected;

      if (
        finalDetected.length === 0
      ) {
        setMessage(
          'No selectable dimensions found. OCR is reading the drawing...'
        );

        try {
          const ocrScale = 6;

          const ocrViewport =
            pdfPage.getViewport({
              scale: ocrScale
            });

          const ocrCanvas =
            document.createElement(
              'canvas'
            );

          const ocrContext =
            ocrCanvas.getContext('2d');

          const pixelRatio = Math.min(
            window.devicePixelRatio || 1,
            2
          );

          ocrCanvas.width =
            Math.ceil(
              ocrViewport.width * pixelRatio
            );

          ocrCanvas.height =
            Math.ceil(
              ocrViewport.height * pixelRatio
            );

          ocrContext.setTransform(
            pixelRatio,
            0,
            0,
            pixelRatio,
            0,
            0
          );

          ocrContext.filter =
            'contrast(140%) brightness(110%)';

          await pdfPage.render({
            canvasContext:
              ocrContext,
            viewport:
              ocrViewport
          }).promise;

          const imageData =
            ocrCanvas.toDataURL(
              'image/png'
            );

          const worker =
            await createWorker('eng');

          const result =
            await worker.recognize(
              imageData
            );

          await worker.terminate();

          const words =
            result.data.words || [];

          const ocrDetected = [];

          for (
            const word of words
          ) {
            if (
              !word.text ||
              !word.text.trim()
            ) {
              continue;
            }

            let text =
              normalizeText(
                word.text
              );

            /*
              OCR corrections.
            */

            text =
              text
                .replace(
                  /O(?=\d)/gi,
                  'Ø'
                )
                .replace(
                  /^0(?=\d)/,
                  'Ø'
                )
                .replace(
                  /x(?=\d)/gi,
                  'Ø'
                );

            if (
              !isCharacteristicText(
                text
              )
            ) {
              continue;
            }

            const ocrX =
              word.bbox?.x0 || 0;

            const ocrY =
              word.bbox?.y0 || 0;

            const x =
              (ocrX / ocrScale) *
              displayScale;

            const y =
              (ocrY / ocrScale) *
              displayScale;

            const pageY =
              ocrY / ocrScale;

            if (
              pageY >
              baseViewport.height * 0.87
            ) {
              continue;
            }

            const pageX =
              ocrX / ocrScale;

            if (
              pageX >
              baseViewport.width * 0.68 &&
              pageY <
              baseViewport.height * 0.12
            ) {
              continue;
            }

            ocrDetected.push({
              text,
              x,
              y,

              width:
                Number(
                  word.bbox?.x1 -
                  word.bbox?.x0 ||
                  0
                ) /
                ocrScale *
                displayScale,

              height:
                Number(
                  word.bbox?.y1 -
                  word.bbox?.y0 ||
                  0
                ) /
                ocrScale *
                displayScale,

              confidence:
                Number(
                  word.confidence || 0
                ),

              source: 'ocr'
            });
          }

          finalDetected =
            removeDuplicateDetections(
              [
                ...finalDetected,
                ...ocrDetected
              ]
            );

        } catch (ocrError) {
          console.error(
            'OCR failed:',
            ocrError
          );

          setMessage(
            'OCR failed. Please use a clearer drawing.'
          );

          return;
        }
      }

      /* =========================================================
         8. CHECK RESULT
      ========================================================= */

      if (
        finalDetected.length === 0
      ) {
        setMessage(
          'No engineering dimensions or tolerances were detected.'
        );

        return;
      }

      /* =========================================================
         9. SORT DETECTIONS
      ========================================================= */

      finalDetected.sort(
        (a, b) => {
          if (
            Math.abs(
              a.y - b.y
            ) < 25
          ) {
            return a.x - b.x;
          }

          return a.y - b.y;
        }
      );

      /* =========================================================
         10. GROUP DIMENSIONS + TOLERANCES
         ---------------------------------------------------------
         THIS IS THE IMPORTANT NEW PART.
      ========================================================= */

      const isCombinedTolerance = (text) => {
        return (
          tolerancePattern.test(text) ||
          bilateralTolerancePattern.test(text)
        );
      };

      const isDiameter = (text) => {
        return diameterPattern.test(text);
      };

      const isRadius = (text) => {
        return radiusPattern.test(text);
      };

      const isNormalDimension = (text) => {
        return (
          dimensionPattern.test(text) &&
          !smallTolerancePattern.test(text)
        );
      };

      const isStandaloneTolerance = (text) => {
        return smallTolerancePattern.test(
          text
        );
      };

      /*
        Get numeric value from a standalone
        tolerance.
  
        Examples:
  
        0.05
        +0.05
        -0.03
      */

      const getToleranceNumber = (text) => {
        const normalized =
          normalizeText(text);

        const match =
          normalized.match(
            /[+-]?\s*(0?\.\d{1,3})/
          );

        if (!match) {
          return null;
        }

        return Number(
          match[1]
        );
      };

      /*
        Determine whether a tolerance is
        positioned close enough to a dimension.
  
        We intentionally use BOTH:
  
        1. X proximity / horizontal alignment
        2. Y proximity
  
        This prevents random 0.02 values
        elsewhere in the drawing from being
        attached to a dimension.
      */

      const isNearbyTolerance = (
        dimension,
        tolerance
      ) => {
        const dimensionCenterX =
          dimension.x +
          (dimension.width || 0) / 2;

        const toleranceCenterX =
          tolerance.x +
          (tolerance.width || 0) / 2;

        const xDifference =
          Math.abs(
            dimensionCenterX -
            toleranceCenterX
          );

        const yDifference =
          Math.abs(
            dimension.y -
            tolerance.y
          );

        /*
          Tolerance normally appears:
  
          - directly above
          - directly below
          - or very slightly beside
            the dimension.
        */

        const maxXDistance =
          Math.max(
            45,
            (dimension.width || 20) * 2.5
          );

        const maxYDistance =
          Math.max(
            60,
            (dimension.height || 12) * 4
          );

        return (
          xDifference <=
          maxXDistance &&
          yDifference <=
          maxYDistance
        );
      };

      /*
        First separate:
  
        MAIN dimensions
        from
        standalone tolerance numbers.
      */

      const mainDimensions = [];

      const standaloneTolerances = [];

      for (
        const item of finalDetected
      ) {
        const text =
          normalizeText(
            item.text
          );

        if (
          isCombinedTolerance(text) ||
          isDiameter(text) ||
          isRadius(text) ||
          isNormalDimension(text)
        ) {
          mainDimensions.push({
            ...item,
            text
          });

          continue;
        }

        if (
          isStandaloneTolerance(text)
        ) {
          standaloneTolerances.push({
            ...item,
            text
          });
        }
      }

      /*
        Each grouped item will represent
        ONE final balloon.
      */

      const groupedDimensions = [];

      /*
        Keep track of tolerance detections
        already consumed by a dimension.
      */

      const consumedToleranceIndexes =
        new Set();

      /* =========================================================
         PROCESS EACH MAIN DIMENSION
      ========================================================= */

      for (
        const dimension of mainDimensions
      ) {
        const text =
          normalizeText(
            dimension.text
          );

        /*
          Already combined tolerance.
  
          Example:
  
          25 ±0.05
          25 +0.05/-0.03
        */

        let plusTolerance =
          '0.00';

        let minusTolerance =
          '0.00';

        let cleanedValue =
          text;

        const plusMinusMatch =
          text.match(
            /^\s*(?:Ø\s*)?(\d+(?:\.\d+)?)\s*±\s*(\d+(?:\.\d+)?)/i
          );

        const bilateralMatch =
          text.match(
            /^\s*(?:Ø\s*)?(\d+(?:\.\d+)?)\s*\+(\d+(?:\.\d+)?)\s*\/\s*-(\d+(?:\.\d+)?)/i
          );

        if (
          plusMinusMatch
        ) {
          cleanedValue =
            plusMinusMatch[1];

          plusTolerance =
            plusMinusMatch[2];

          minusTolerance =
            plusMinusMatch[2];
        }

        if (
          bilateralMatch
        ) {
          cleanedValue =
            bilateralMatch[1];

          plusTolerance =
            bilateralMatch[2];

          minusTolerance =
            bilateralMatch[3];
        }

        /*
          Diameter.
        */

        const diameterMatch =
          text.match(
            /Ø\s*(\d+(?:\.\d+)?)/i
          );

        if (
          diameterMatch &&
          !plusMinusMatch &&
          !bilateralMatch
        ) {
          cleanedValue =
            diameterMatch[1];
        }

        /*
          Radius.
        */

        const radiusMatch =
          text.match(
            /R\s*(\d+(?:\.\d+)?)/i
          );

        if (
          radiusMatch &&
          !plusMinusMatch &&
          !bilateralMatch
        ) {
          cleanedValue =
            radiusMatch[1];
        }

        /*
          Normal numeric dimension.
        */

        const numericMatch =
          text.match(
            /^\s*(\d+(?:\.\d+)?)\s*(?:mm|in|inch|inches)?\s*$/i
          );

        if (
          numericMatch &&
          !plusMinusMatch &&
          !bilateralMatch
        ) {
          cleanedValue =
            numericMatch[1];
        }

        /*
          -------------------------------------------------------
          FIND NEARBY STANDALONE TOLERANCES
          -------------------------------------------------------
        */

        const nearbyTolerances = [];

        standaloneTolerances.forEach(
          (
            tolerance,
            toleranceIndex
          ) => {
            if (
              consumedToleranceIndexes.has(
                toleranceIndex
              )
            ) {
              return;
            }

            if (
              !isNearbyTolerance(
                dimension,
                tolerance
              )
            ) {
              return;
            }

            nearbyTolerances.push({
              tolerance,
              toleranceIndex
            });
          }
        );

        /*
          -------------------------------------------------------
          SORT NEARBY TOLERANCES
          -------------------------------------------------------
  
          We sort vertically.
  
          Engineering drawings commonly
          represent unequal tolerance as:
  
                16
               0.05
               0.03
  
          Therefore:
  
          TOP    = PLUS
          BOTTOM = MINUS
        */

        nearbyTolerances.sort(
          (a, b) => {
            return (
              a.tolerance.y -
              b.tolerance.y
            );
          }
        );

        /*
          Only use the closest tolerance
          values.
  
          This prevents unrelated 0.02 / 0.05
          values from being attached.
        */

        const usableTolerances =
          nearbyTolerances.slice(
            0,
            2
          );

        /*
          -------------------------------------------------------
          ONE TOLERANCE
          -------------------------------------------------------
  
          Example:
  
          25
          0.05
  
          Treat as ±0.05.
        */

        if (
          usableTolerances.length === 1
        ) {
          const tolerance =
            usableTolerances[0];

          const toleranceValue =
            getToleranceNumber(
              tolerance.tolerance.text
            );

          if (
            Number.isFinite(
              toleranceValue
            )
          ) {
            plusTolerance =
              toleranceValue.toFixed(3);

            minusTolerance =
              toleranceValue.toFixed(3);

            consumedToleranceIndexes.add(
              tolerance.toleranceIndex
            );
          }
        }

        /*
          -------------------------------------------------------
          TWO TOLERANCES
          -------------------------------------------------------
  
          Example:
  
               16
               0.05
               0.03
  
          TOP    = +0.05
          BOTTOM = -0.03
        */

        if (
          usableTolerances.length >= 2
        ) {
          const first =
            usableTolerances[0];

          const second =
            usableTolerances[1];

          const firstValue =
            getToleranceNumber(
              first.tolerance.text
            );

          const secondValue =
            getToleranceNumber(
              second.tolerance.text
            );

          if (
            Number.isFinite(
              firstValue
            ) &&
            Number.isFinite(
              secondValue
            )
          ) {
            /*
              If explicit signs exist,
              respect them.
            */

            const firstHasMinus =
              /^-/.test(
                normalizeText(
                  first.tolerance.text
                )
              );

            const firstHasPlus =
              /^\+/.test(
                normalizeText(
                  first.tolerance.text
                )
              );

            const secondHasMinus =
              /^-/.test(
                normalizeText(
                  second.tolerance.text
                )
              );

            const secondHasPlus =
              /^\+/.test(
                normalizeText(
                  second.tolerance.text
                )
              );

            if (
              firstHasPlus &&
              secondHasMinus
            ) {
              plusTolerance =
                firstValue.toFixed(3);

              minusTolerance =
                secondValue.toFixed(3);
            } else if (
              firstHasMinus &&
              secondHasPlus
            ) {
              plusTolerance =
                secondValue.toFixed(3);

              minusTolerance =
                firstValue.toFixed(3);
            } else {
              /*
                No signs visible.
  
                Use engineering drawing
                convention:
  
                TOP = PLUS
                BOTTOM = MINUS
              */

              plusTolerance =
                firstValue.toFixed(3);

              minusTolerance =
                secondValue.toFixed(3);
            }

            consumedToleranceIndexes.add(
              first.toleranceIndex
            );

            consumedToleranceIndexes.add(
              second.toleranceIndex
            );
          }
        }

        /*
          -------------------------------------------------------
          DETERMINE TYPE
          -------------------------------------------------------
        */

        let type =
          'Dimension';

        if (
          diameterPattern.test(text)
        ) {
          type =
            'Diameter';
        } else if (
          radiusPattern.test(text)
        ) {
          type =
            'Radius';
        }

        /*
          -------------------------------------------------------
          FINAL VALUE
          -------------------------------------------------------
        */

        const value =
          cleanedValue;

        /*
          -------------------------------------------------------
          LIMIT CALCULATION
          -------------------------------------------------------
        */

        const numericValue =
          Number(value);

        const plus =
          Number(
            plusTolerance
          );

        const minus =
          Number(
            minusTolerance
          );

        let upperLimit =
          '0.00';

        let lowerLimit =
          '0.00';

        if (
          Number.isFinite(
            numericValue
          )
        ) {
          upperLimit =
            (
              numericValue +
              (
                Number.isFinite(
                  plus
                )
                  ? plus
                  : 0
              )
            ).toFixed(3);

          lowerLimit =
            (
              numericValue -
              (
                Number.isFinite(
                  minus
                )
                  ? minus
                  : 0
              )
            ).toFixed(3);
        }

        /*
          -------------------------------------------------------
          BUILD SPECIFICATION
          -------------------------------------------------------
        */

        let specification =
          text;

        /*
          If tolerances were detected separately,
          create a combined specification.
        */

        if (
          plusTolerance !== '0.00' ||
          minusTolerance !== '0.00'
        ) {
          if (
            plusTolerance ===
            minusTolerance
          ) {
            specification =
              `${value} ±${plusTolerance}`;
          } else {
            specification =
              `${value} +${plusTolerance}/-${minusTolerance}`;
          }
        }

        groupedDimensions.push({
          ...dimension,

          text,

          value,

          type,

          plusTolerance,

          minusTolerance,

          upperLimit,

          lowerLimit,

          specification
        });
      }

      /* =========================================================
         IMPORTANT:
         Tolerance-only detections are NOT included.
  
         They were consumed by their parent dimension.
      ========================================================= */

      const limited =
        groupedDimensions.slice(
          0,
          80
        );

      /* =========================================================
         11. CHECK GROUPED RESULT
      ========================================================= */

      if (
        limited.length === 0
      ) {
        setMessage(
          'No usable engineering characteristics were detected.'
        );

        return;
      }

      /* =========================================================
         12. FIND NEXT BALLOON NUMBER
      ========================================================= */

      let currentMaxNumber = 0;

      balloons.forEach(
        (balloon) => {
          const number =
            Number(
              balloon.number
            );

          if (
            Number.isFinite(
              number
            ) &&
            number >
            currentMaxNumber
          ) {
            currentMaxNumber =
              number;
          }
        }
      );

      characteristics.forEach(
        (characteristic) => {
          const number =
            Number(
              characteristic.number
            );

          if (
            Number.isFinite(
              number
            ) &&
            number >
            currentMaxNumber
          ) {
            currentMaxNumber =
              number;
          }
        }
      );

      /* =========================================================
         13. CREATE BALLOONS + CHARACTERISTICS
      ========================================================= */

      let createdCount = 0;

      for (
        const item of limited
      ) {
        try {
          /*
            Increment only ONCE.
  
            Tolerances no longer receive
            separate balloon numbers.
          */

          currentMaxNumber += 1;

          const nextNumber =
            currentMaxNumber;

          /* =====================================================
             BALLOON + VALUE POSITIONS
             -----------------------------------------------------
             The balloon is placed AWAY from the value so the
             measurement stays visible. The arrow then points
             back at the value.
          ===================================================== */

          const valueCenterX =
            item.x +
            (item.width || 0) / 2;

          /*
            PDF text y is the BASELINE (bottom of the text).
            OCR text y is the TOP of the word box.
          */

          const valueCenterY =
            item.source === 'ocr'
              ? item.y +
                (item.height || 0) /
                  2
              : item.y -
                (item.height || 0) /
                  2;

          /*
            Offset the balloon above the value,
            alternating left / right to spread
            neighbouring balloons apart.
          */

          const arrowDistance =
            60;

          const horizontalSpread =
            40;

          const balloonX =
            valueCenterX +
            (createdCount % 2 === 0
              ? horizontalSpread
              : -horizontalSpread);

          const balloonY =
            valueCenterY -
            arrowDistance;

          /* =====================================================
             CREATE BALLOON
          ===================================================== */

          const balloon =
            await api.post(
              `/projects/${id}/balloons`,
              {
                x:
                  balloonX,

                y:
                  balloonY,

                anchorX:
                  valueCenterX,

                anchorY:
                  valueCenterY,

                /*
                  Store the ORIGINAL
                  dimension text.
  
                  Example:
  
                  16
  
                  or
  
                  25 ±0.05
                */

                text:
                  item.text,

                type:
                  item.type,

                number:
                  nextNumber,

                page:
                  pageNumber,

                status:
                  'Draft'
              }
            );

          /* =====================================================
             CREATE CHARACTERISTIC
          ===================================================== */

          const characteristic =
            await api.post(
              `/projects/${id}/characteristics`,
              {
                balloonId:
                  balloon._id,

                number:
                  nextNumber,

                type:
                  item.type,

                /*
                  MAIN VALUE ONLY
  
                  Example:
                  16
                */

                value:
                  item.value,

                unit:
                  'mm',

                /*
                  GROUPED TOLERANCES
  
                  Example:
                  +0.05
                  -0.03
                */

                plusTolerance:
                  item.plusTolerance,

                minusTolerance:
                  item.minusTolerance,

                upperLimit:
                  item.upperLimit,

                lowerLimit:
                  item.lowerLimit,

                /*
                  Combined engineering
                  specification.
  
                  Example:
  
                  16 +0.05/-0.03
  
                  OR
  
                  25 ±0.05
                */

                specification:
                  item.specification,

                inspectionMethod:
                  'Vernier Caliper',

                instrument:
                  '',

                actualValue:
                  '',

                result:
                  'NOT INSPECTED',

                remarks:
                  '',

                page:
                  pageNumber,

                x:
                  item.x,

                y:
                  item.y,

                status:
                  'Draft'
              }
            );

          /* =====================================================
             UPDATE BALLOONS
          ===================================================== */

          setBalloons(
            (prev) => [
              ...prev,

              {
                ...balloon,

                number:
                  nextNumber,

                x:
                  balloonX,

                y:
                  balloonY,

                page:
                  pageNumber,

                /*
                  Keep detected value
                  available to UI.
                */

                text:
                  item.text,

                type:
                  item.type
              }
            ]
          );

          /* =====================================================
             UPDATE CHARACTERISTICS
          ===================================================== */

          setCharacteristics(
            (prev) => [
              ...prev,

              {
                ...characteristic,

                number:
                  nextNumber,

                value:
                  item.value,

                plusTolerance:
                  item.plusTolerance,

                minusTolerance:
                  item.minusTolerance,

                upperLimit:
                  item.upperLimit,

                lowerLimit:
                  item.lowerLimit,

                specification:
                  item.specification,

                x:
                  item.x,

                y:
                  item.y,

                page:
                  pageNumber
              }
            ]
          );

          createdCount++;

        } catch (error) {
          console.error(
            'Balloon creation failed:',
            error
          );
        }
      }

      /* =========================================================
         14. FINAL MESSAGE
      ========================================================= */

      if (
        createdCount === 0
      ) {
        setMessage(
          'No usable engineering characteristics were detected.'
        );
      } else {
        setMessage(
          `${createdCount} engineering characteristic(s) detected successfully.`
        );
      }

    } catch (error) {
      console.error(
        'Automatic detection error:',
        error
      );

      setMessage(
        error.message ||
        'Automatic detection failed'
      );

    } finally {
      setAutoDetecting(false);
    }
  };
  /* =========================================================
   BALLOON DRAG EVENTS
========================================================= */

  useEffect(() => {
    window.addEventListener(
      'pointermove',
      handleBalloonPointerMove
    );

    window.addEventListener(
      'pointerup',
      handleBalloonPointerUp
    );

    return () => {
      window.removeEventListener(
        'pointermove',
        handleBalloonPointerMove
      );

      window.removeEventListener(
        'pointerup',
        handleBalloonPointerUp
      );
    };
  }, [
    balloons,
    characteristics
  ]);


  return (
    <div className="space-y-4">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">

        <div>
          <div className="text-sm text-slate-500">
            Project / Drawing Workspace
          </div>

          <div className="font-semibold text-slate-900">
            {project?.projectNumber ||
              'New Project'}
          </div>

          <div className="text-sm text-slate-600">
            {project?.customerName} •{' '}
            {project?.drawingNumber} Rev{' '}
            {project?.revision}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">

          {/* ADD BALLOON (toggle) */}

          <button
            className={`rounded border px-3 py-2 text-sm flex items-center gap-1 ${mode === 'manual'
              ? 'bg-slate-900 text-white'
              : ''
              }`}
            onClick={() =>
              setMode((prev) =>
                prev === 'manual'
                  ? 'none'
                  : 'manual'
              )
            }
          >
            <Plus size={15} />
            {mode === 'manual'
              ? 'Add Balloon: ON'
              : 'Add Balloon'}
          </button>

          {/* ADD BALLOON HINT */}

          {mode === 'manual' ? (
            <span className="text-xs text-amber-700">
              Click the drawing to place a new balloon
            </span>
          ) : null}

          {/* AUTO */}

          <button
            className={`rounded border px-3 py-2 text-sm flex items-center gap-1 ${mode === 'auto'
              ? 'bg-blue-600 text-white'
              : ''
              }`}
            onClick={autoDetect}
            disabled={
              autoDetecting ||
              !pdfPage
            }
          >
            <Wand2 size={15} />

            {autoDetecting
              ? 'Detecting...'
              : 'Auto Detect'}
          </button>

          {/* CLEAR ALL */}

          <button
            className="rounded border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-1"
            onClick={
              clearAllBallooning
            }
            disabled={
              balloons.length === 0 &&
              characteristics.length === 0
            }
          >
            <Eraser size={15} />
            Clear All Ballooning
          </button>

          {/* SAVE */}

          <button
            className="rounded border px-3 py-2 text-sm"
            onClick={saveProject}
          >
            <Save
              size={15}
              className="inline mr-1"
            />
            Save
          </button>

          {/* ZOOM IN */}

          <button
            className="rounded border px-3 py-2 text-sm"
            onClick={() =>
              setZoom((z) =>
                Math.min(
                  2,
                  z + 0.1
                )
              )
            }
          >
            <ZoomIn
              size={15}
              className="inline mr-1"
            />
            Zoom +
          </button>

          {/* ZOOM OUT */}

          <button
            className="rounded border px-3 py-2 text-sm"
            onClick={() =>
              setZoom((z) =>
                Math.max(
                  0.5,
                  z - 0.1
                )
              )
            }
          >
            <ZoomOut
              size={15}
              className="inline mr-1"
            />
            Zoom -
          </button>

        </div>
      </div>

      {/* =====================================================
          MESSAGE
      ===================================================== */}

      {message ? (
        <div className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
          {message}
        </div>
      ) : null}

      {/* =====================================================
          MAIN AREA
      ===================================================== */}

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_280px]">

        {/* ===================================================
            LEFT PANEL
        =================================================== */}

        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">

          <div className="mb-3 font-semibold text-slate-900">
            Pages
          </div>

          <div className="flex items-center justify-between rounded border bg-slate-50 p-2 text-sm">

            <button
              onClick={
                previousPage
              }
              disabled={
                pageNumber <= 1
              }
              className="rounded p-1 hover:bg-white disabled:opacity-30"
            >
              <ChevronLeft
                size={18}
              />
            </button>

            <span>
              Page {pageNumber} /{' '}
              {pageCount}
            </span>

            <button
              onClick={nextPage}
              disabled={
                pageNumber >=
                pageCount
              }
              className="rounded p-1 hover:bg-white disabled:opacity-30"
            >
              <ChevronRight
                size={18}
              />
            </button>

          </div>

          {/* UPLOAD */}

          <div className="mt-4">

            <label className="block text-sm text-slate-600">
              Upload drawing
            </label>

            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={
                uploadDrawing
              }
              className="mt-2 block w-full text-sm"
            />

            {uploading ? (
              <div className="mt-2 text-sm text-slate-500">
                Uploading...
              </div>
            ) : null}

          </div>

          {/* DRAWINGS */}

          <div className="mt-4">

            <div className="mb-2 text-sm font-semibold text-slate-900">
              Drawings
            </div>

            <div className="space-y-2">

              {drawings.length ===
                0 ? (
                <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  No drawings uploaded
                </div>
              ) : (
                drawings.map(
                  (item) => (

                    <div
                      key={
                        item._id
                      }
                      className={`relative group rounded border px-3 py-3 ${selectedDrawingId ===
                        item._id
                        ? 'border-slate-900 bg-slate-100'
                        : 'border-slate-200 bg-white'
                        }`}
                    >

                      <div className="flex items-center justify-between gap-3">

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDrawingId(
                              item._id
                            );

                            setActiveDrawingMenuId(
                              null
                            );
                          }}
                          className="flex min-w-0 items-center gap-2 text-left text-sm text-slate-800"
                        >
                          <span className="text-slate-500">
                            📄
                          </span>

                          <span className="truncate">
                            {
                              item.fileName
                            }
                          </span>

                        </button>

                        <button
                          type="button"
                          onClick={(
                            event
                          ) => {
                            event.stopPropagation();

                            setActiveDrawingMenuId(
                              (
                                current
                              ) =>
                                current ===
                                  item._id
                                  ? null
                                  : item._id
                            );
                          }}
                          className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100"
                        >
                          ⋮
                        </button>

                      </div>

                      {activeDrawingMenuId ===
                        item._id ? (
                        <div className="absolute right-3 top-full z-20 mt-2 w-40 overflow-hidden rounded border bg-white shadow-lg">

                          <button
                            type="button"
                            onClick={() => {
                              window.open(
                                drawingUrlFor(
                                  item
                                ),
                                '_blank',
                                'noopener'
                              );

                              setActiveDrawingMenuId(
                                null
                              );
                            }}
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                          >
                            Open PDF
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const newName =
                                window.prompt(
                                  'Rename drawing',
                                  item.fileName
                                );

                              if (
                                newName &&
                                newName.trim() &&
                                newName.trim() !==
                                item.fileName
                              ) {
                                renameDrawing(
                                  item._id,
                                  newName.trim()
                                );
                              }
                            }}
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                          >
                            Rename
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteDrawingId(
                                item._id
                              );

                              setActiveDrawingMenuId(
                                null
                              );
                            }}
                            className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-slate-50"
                          >
                            Delete
                          </button>

                        </div>
                      ) : null}

                    </div>

                  )
                )
              )}

            </div>

          </div>

        </div>

        {/* ===================================================
            PDF VIEWER
        =================================================== */}

        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">

            <div className="font-semibold text-slate-900">
              Engineering Drawing Viewer
            </div>

            <div className="flex items-center gap-2">

              <span className="rounded bg-slate-100 px-3 py-1 text-xs text-slate-600">
                {mode ===
                  'manual'
                  ? 'Manual Ballooning'
                  : 'Automatic Ballooning'}
              </span>

              <span className="text-xs text-slate-500">
                Zoom{' '}
                {Math.round(
                  zoom * 100
                )}
                %
              </span>

            </div>

          </div>

          <div
            ref={
              pdfContainerRef
            }
            className="relative min-h-[650px] overflow-auto rounded-lg border border-slate-300 bg-slate-200"
          >

            {!selectedDrawing ? (

              <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                Upload a drawing to begin ballooning
              </div>

            ) : loadingPdf ? (

              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-lg bg-white px-5 py-4 shadow">
                  Loading engineering drawing...
                </div>
              </div>

            ) : drawingError ? (

              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white p-4 text-center">

                <div className="text-lg font-semibold">
                  Unable to load drawing
                </div>

                <div className="max-w-xl break-all text-sm text-slate-500">
                  {drawingUrl}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      drawingUrl,
                      '_blank',
                      'noopener'
                    )
                  }
                  className="rounded bg-slate-900 px-4 py-2 text-sm text-white"
                >
                  Open PDF
                </button>

              </div>

            ) : isPdf ? (

              <div className="flex min-w-full justify-center p-5">

                <div
                  className="relative bg-white shadow-xl"
                  onClick={
                    createBalloon
                  }
                >

                  <canvas
                    ref={
                      canvasRef
                    }
                    className="block"
                  />

                  {/* BALLOON OVERLAY */}

                  <div className="pointer-events-none absolute inset-0">

                    {/* LEADER ARROWS: each balloon points an
                        arrow at its measurement / value */}

                    <svg
                      className="absolute inset-0 h-full w-full"
                      style={{ overflow: 'visible' }}
                    >
                      {displayedBalloons
                        .filter(
                          (
                            balloon
                          ) =>
                            !balloon.page ||
                            balloon.page ===
                            pageNumber
                        )
                        .map(
                          (
                            balloon
                          ) => {
                            const x =
                              balloon.x ?? 0;
                            const y =
                              balloon.y ?? 0;
                            const ax =
                              balloon.anchorX ??
                              x + 25;
                            const ay =
                              balloon.anchorY ??
                              y + 25;

                            /*
                              Direction from the balloon
                              TOWARDS the value.
                            */

                            const dx =
                              ax - x;

                            const dy =
                              ay - y;

                            const dist =
                              Math.hypot(
                                dx,
                                dy
                              ) || 1;

                            const ux =
                              dx / dist;

                            const uy =
                              dy / dist;

                            /*
                              Balloon marker radius
                              (h-6 circle => 12px).
                            */

                            const R = 12;
                            const head = 7;

                            /*
                              Line starts at the balloon
                              edge and ends at the value.
                            */

                            const startX =
                              x + ux * R;

                            const startY =
                              y + uy * R;

                            const angle =
                              Math.atan2(
                                uy,
                                ux
                              );

                            return (
                              <g
                                key={`arrow-${balloon._id}`}
                              >
                                {/* leader line */}
                                <line
                                  x1={startX}
                                  y1={startY}
                                  x2={ax}
                                  y2={ay}
                                  stroke="#dc2626"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                />

                                {/* arrowhead pointing AT
                                    the measurement */}
                                <polygon
                                  points={`${ax},${ay} ${ax - head * Math.cos(angle - 0.35)},${ay - head * Math.sin(angle - 0.35)} ${ax - head * Math.cos(angle + 0.35)},${ay - head * Math.sin(angle + 0.35)}`}
                                  fill="#dc2626"
                                />
                              </g>
                            );
                          }
                        )}
                    </svg>

                    {displayedBalloons
                      .filter(
                        (
                          balloon
                        ) =>
                          !balloon.page ||
                          balloon.page ===
                          pageNumber
                      )
                      .map(
                        (
                          balloon
                        ) => (

                          <div
                            key={balloon._id}
                            className="absolute pointer-events-auto balloon-marker cursor-move select-none"
                            style={{
                              left: balloon.x,
                              top: balloon.y,
                              transform:
                                'translate(-50%, -50%)',
                              touchAction: 'none'
                            }}
                            onPointerDown={(event) =>
                              handleBalloonPointerDown(
                                event,
                                balloon
                              )
                            }
                          >

                            <button
                              type="button"
                              className={`flex h-6 min-w-6 items-center justify-center rounded-full border-[1.5px] px-1.5 text-[10px] font-bold text-white shadow-sm ${selectedBalloonId ===
                                balloon._id
                                ? 'border-yellow-300 bg-yellow-500'
                                : 'border-red-600 bg-red-600'
                                }`}
                              onPointerDown={(event) => {
                                event.stopPropagation();

                                handleBalloonPointerDown(
                                  event,
                                  balloon
                                );
                              }}
                            >
                              {balloon.number}
                            </button>

                          </div>

                        )
                      )}

                  </div>

                </div>

              </div>

            ) : (

              <div className="flex h-full min-h-[650px] items-center justify-center p-5">

                <img
                  src={
                    drawingUrl
                  }
                  alt={
                    selectedDrawing.fileName
                  }
                  className="max-h-[650px] max-w-full object-contain"
                />

              </div>

            )}

          </div>

          {/* VIEWER CONTROLS */}

          {isPdf &&
            pdfPage ? (

            <div className="mt-3 flex items-center justify-center gap-2">

              <button
                onClick={() =>
                  setZoom(1)
                }
                className="rounded border bg-white px-3 py-2 text-sm"
              >
                <Maximize
                  size={14}
                  className="inline mr-1"
                />
                Fit
              </button>

              <button
                onClick={
                  previousPage
                }
                disabled={
                  pageNumber <=
                  1
                }
                className="rounded border px-3 py-2 text-sm disabled:opacity-40"
              >
                Previous
              </button>

              <span className="px-3 text-sm text-slate-600">
                {pageNumber} /{' '}
                {pageCount}
              </span>

              <button
                onClick={
                  nextPage
                }
                disabled={
                  pageNumber >=
                  pageCount
                }
                className="rounded border px-3 py-2 text-sm disabled:opacity-40"
              >
                Next
              </button>

            </div>

          ) : null}

        </div>

        {/* ===================================================
            SELECTED BALLOON
        =================================================== */}

        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">

          <div className="mb-3 font-semibold text-slate-900">
            Edit Balloon / Characteristic
          </div>

          <div className="space-y-4">

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Balloon No
              </label>

              <input
                type="text"
                value={currentBalloonNo}
                onChange={(e) =>
                  handleBalloonNumberChange(e.target.value)
                }
                onKeyDown={handleBalloonNumberKeyDown}
                placeholder="Enter balloon number"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Description
              </label>

              <input
                type="text"
                value={editData?.specification ?? ''}
                onChange={(e) =>
                  setEditData((prev) =>
                    prev
                      ? {
                          ...prev,
                          specification: e.target.value
                        }
                      : prev
                  )
                }
                placeholder="—"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Dimension No (mm)
              </label>

              <input
                type="text"
                value={editData?.value ?? ''}
                onChange={(e) =>
                  setEditData((prev) =>
                    prev
                      ? {
                          ...prev,
                          value: e.target.value
                        }
                      : prev
                  )
                }
                placeholder="—"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Upper Tolerance (+) mm
              </label>

              <input
                type="text"
                value={editData?.plusTolerance ?? ''}
                onChange={(e) =>
                  setEditData((prev) =>
                    prev
                      ? {
                          ...prev,
                          plusTolerance: e.target.value
                        }
                      : prev
                  )
                }
                placeholder="—"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Lower Tolerance (-) mm
              </label>

              <input
                type="text"
                value={editData?.minusTolerance ?? ''}
                onChange={(e) =>
                  setEditData((prev) =>
                    prev
                      ? {
                          ...prev,
                          minusTolerance: e.target.value
                        }
                      : prev
                  )
                }
                placeholder="—"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <button
              type="button"
              onClick={saveEdit}
              disabled={!editData || !!savingCharacteristicId}
              className="flex w-full items-center justify-center gap-2 rounded border border-slate-900 bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {savingCharacteristicId ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {savingCharacteristicId ? 'Saving...' : 'Save'}
            </button>

            <button
              onClick={() => deleteBalloon(selectedBalloonId)}
              disabled={!editData}
              className="flex w-full items-center justify-center gap-2 rounded border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 size={14} />
              Delete Balloon
            </button>

            <button
              type="button"
              onClick={() => setShowCharacteristicsTable(true)}
              className="flex w-full items-center justify-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Table2 size={14} />
              Table
            </button>

          </div>

        </div>

        {/* =====================================================
          DELETE DRAWING CONFIRMATION
      ===================================================== */}

        {confirmDeleteDrawingId ? (

          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">

            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">

              <div className="mb-4 text-lg font-semibold">
                Confirm drawing delete
              </div>

              <div className="mb-6 text-sm text-slate-600">
                This will remove the drawing file and its viewer entry. Are you sure?
              </div>

              <div className="flex justify-end gap-3">

                <button
                  onClick={() =>
                    setConfirmDeleteDrawingId(
                      null
                    )
                  }
                  className="rounded border px-4 py-2 text-sm"
                >
                  Cancel
                </button>

                <button
                  onClick={() =>
                    deleteDrawing(
                      confirmDeleteDrawingId
                    )
                  }
                  className="rounded bg-red-600 px-4 py-2 text-sm text-white"
                >
                  Delete
                </button>

              </div>

            </div>

          </div>

        ) : null}

        {/* =====================================================
          CHARACTERISTICS TABLE MODAL
      ===================================================== */}

        {showCharacteristicsTable ? (

          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">

            <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-xl bg-white p-6 shadow-xl">

              <div className="mb-4 flex items-center justify-between">

                <div className="text-lg font-semibold">
                  Ballooning Table
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowCharacteristicsTable(false)
                  }
                  className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>

              </div>

              {characteristics.length === 0 ? (

                <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                  No ballooning yet for this project.
                </div>

              ) : (

                <div className="overflow-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-4 py-3">Balloon No</th>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3">Dimension No (mm)</th>
                        <th className="px-4 py-3">Upper Tolerance (+) mm</th>
                        <th className="px-4 py-3">Lower Tolerance (-) mm</th>
                      </tr>
                    </thead>
                    <tbody>
                      {characteristics
                        .slice()
                        .sort((a, b) =>
                          Number(a.number || 0) - Number(b.number || 0)
                        )
                        .map((characteristic) => (
                          <tr
                            key={characteristic._id}
                            className="border-t border-slate-100 hover:bg-slate-50"
                          >
                            <td className="px-4 py-3 font-semibold text-slate-800">
                              {characteristic.number || '-'}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {characteristic.specification || '-'}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {characteristic.value || '-'}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {characteristic.plusTolerance || '-'}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {characteristic.minusTolerance || '-'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

              )}

            </div>

          </div>

        ) : null}

    </div>
  </div>
  );
}