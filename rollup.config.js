import resolve from '@rollup/plugin-node-resolve';
import buble from '@rollup/plugin-buble';

export default {
  input: 'leaflet-imageoverlay-gcp.js',
  output: {
    file: 'docs/leaflet-imageoverlay-gcp.js',
    format: 'iife'
  },
  plugins: [
    resolve(),
    buble()
  ]
};
