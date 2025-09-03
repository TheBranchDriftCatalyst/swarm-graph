// Temporary declarations to assist TS during incremental migration
declare module './App' {
  const App: any
  export default App
}

declare module '*.jsx' {
  const anyExport: any
  export default anyExport
}
