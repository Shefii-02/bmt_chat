const router = require("express").Router();
const chatController = require("./chat.controller");
const auth = require("../../middlewares/auth.middleware");

router.get(
  "/class/:class_id",
  auth,
  chatController.getClassMessages
);

module.exports = router;
