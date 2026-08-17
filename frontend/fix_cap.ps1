
Remove-Item -Recurse -Force android
npm uninstall @capacitor/core @capacitor/cli @capacitor/android
npm install @capacitor/core@6 @capacitor/android@6
npm install -D @capacitor/cli@6
npx cap add android
npx cap sync

