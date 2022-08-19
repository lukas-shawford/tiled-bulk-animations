const rewire = require('rewire');
rewire('../mocks/tiled');
const bulkAnimations = rewire('../../bulk-animations/bulk-animations');

const bulkAnimationEditor = bulkAnimations.__get__('bulkAnimationEditor');

module.exports = bulkAnimationEditor;
