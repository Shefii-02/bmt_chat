const router = require('express').Router();
const controller = require('./poll.controller');

router.post('/', controller.createPoll);
router.get('/:class_id', controller.getActivePoll);

module.exports = router;
