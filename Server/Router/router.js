const express= require("express");
const router= express.Router();
const startSyncProcess= require('../Controller/controller');
router.post('/getBulkProducts',startSyncProcess);
//router.route('/register').get(register);
 

module.exports=router;