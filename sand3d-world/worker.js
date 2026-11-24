// Runs Sand3D programs off the main thread: Python (Pyodide) with the Blender-free port.
const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/';
importScripts(`${PYODIDE}pyodide.js`);

let run = null;
const ready = (async () => {
  const [py, shim] = await Promise.all([loadPyodide({ indexURL: PYODIDE }), fetch('../sand3d-live/sand3d.py').then((r) => r.text())]);
  await py.loadPackage('numpy');
  py.FS.writeFile('/home/pyodide/sand3d.py', shim);
  py.runPython('import sand3d');
  run = py.globals.get('sand3d').run;
  postMessage({ ready: true });
})();

onmessage = async ({ data }) => {
  try {
    await ready;
    const t0 = performance.now();
    const json = run(data.program, data.entry);
    postMessage({ id: data.id, json, ms: performance.now() - t0 });
  } catch (error) {
    postMessage({ id: data.id, error: String(error.message || error).trim().split('\n').pop() });
  }
};
