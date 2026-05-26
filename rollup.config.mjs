import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/js/oa-homepage.js',
  output: {
    file: 'dist/oa-homepage.js',
    format: 'iife',
    name: 'OAHomepage'
  },
  plugins: [resolve(), terser()]
};
