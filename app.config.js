// The GitHub Pages build (STATIC_DEMO=true) serves the web app from /spendsense-mobile/.
module.exports = ({ config }) =>
  process.env.STATIC_DEMO === 'true'
    ? { ...config, experiments: { ...config.experiments, baseUrl: '/spendsense-mobile' } }
    : config;
