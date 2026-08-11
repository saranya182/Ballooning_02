const fs = require('fs');
const path = require('path');
const dir = path.join(process.cwd(), 'sample_assets');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const data = 'iVBORw0KGgoAAAANSUhEUgAAAZAAAAGQCAIAAAD3O9nNAAAACXBIWXMAAAsSAAALEgHS3X78AAAEkElEQVR4nO3VsQ3DMAwEwfr/T7pyEAJ0QHhMdeKViCrpCsSFrk+CTkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADzHc/vf8kAAIC/BLFqd7Ltm0YBADk+qkRvZMCAACgStW/MAACAKvYFAAAQCF+wBwAAQC0+eAAAAEAvr2AQAAAEC9PgAAAABAL69gEAAABA5gEAAABA5gEAAABA5gEAAABA5gEAAABA5gEAAABAu1Nv6A0NbJ+y12BAAAAABJRU5ErkJggg==';
const buffer = Buffer.from(data, 'base64');
const filePath = path.join(dir, 'sample_drawing.png');
fs.writeFileSync(filePath, buffer);
console.log(filePath);
