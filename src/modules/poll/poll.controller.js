const Poll = require('../../models/Poll');

exports.createPoll = async (req, res) => {
  const poll = await Poll.create(req.body);
  res.json(poll);
};

exports.getActivePoll = async (req, res) => {
  const poll = await Poll.findOne({
    where: { class_id: req.params.class_id, is_active: true }
  });
  res.json(poll);
};


