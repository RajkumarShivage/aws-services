
exports.handler = function (event, context) {

  var aws_sts = new (require('../lib/aws/sts'))();
  var aws_bucket = new (require('../lib/aws/s3bucket.js'))();
  var aws_topic = new (require('../lib/aws/topic.js'))();
  var aws_role = new (require('../lib/aws/role.js'))();
  var aws_config = new (require('../lib/aws/awsconfig.js'))();

  var roles = [];
  if (event.profile) {
    roles.push({roleArn:'arn:aws:iam::' + event.federate_account + ':role/cto_across_accounts'});
  }
  roles.push({roleArn:'arn:aws:iam::' + event.federate_account + ':role/federate'});
  roles.push({roleArn:'arn:aws:iam::' + event.account + ':role/' + event.roleName});

  var fs = require("fs");
  data = fs.readFileSync(__dirname + '/json/data.json', {encoding:'utf8'});
  data_json = JSON.parse(data);

  var assumeRolePolicyDocument = fs.readFileSync(__dirname + '/json/' + data_json.assumeRolePolicyName + '.json', {encoding:'utf8'});
  console.log(assumeRolePolicyDocument);

  var inlinePolicyDocument = fs.readFileSync(__dirname + '/json/' + data_json.inlinePolicyName + '.json', {encoding:'utf8'});
  console.log(inlinePolicyDocument);

  var input = {
    profile: (event.profile === undefined) ? null : event.profile,
    sessionName: event.sessionName,
    roles: roles,
    region: event.region,
    deliveryChannelName : data_json.deliveryChannelName,
    configRecorderName : data_json.configRecorderName,
    bucketName : event.account + data_json.bucketNamePostfix,
    topicName : data_json.topicName,
    assumeRolePolicyName: data_json.assumeRolePolicyName,
    assumeRolePolicyDocument: assumeRolePolicyDocument,
    roleName : data_json.roleName,
    inlinePolicyName : data_json.inlinePolicyName,
    inlinePolicyDocument: inlinePolicyDocument,
    roleArn : null,
    topicArn : null,
    inlinePolicyDoc : null
  };

  function succeeded(input) { context.done(null, true); }
  function failed(input) { context.done(null, false); }
  function errored(err) { context.fail(err, null); }

  var flows = [
    {func:aws_sts.assumeRoles, success:aws_role.findRole, failure:failed, error:errored},
    {func:aws_role.findRole, success:aws_role.findInlinePolicy, failure:aws_role.createRole, error:errored},
    {func:aws_role.createRole, success:aws_role.findInlinePolicy, failure:failed, error:errored},
    {func:aws_role.findInlinePolicy, success:aws_bucket.findBucket, failure:aws_role.createInlinePolicy, error:errored},
    {func:aws_role.createInlinePolicy, success:aws_role.wait, failure:failed, error:errored},
    {func:aws_role.wait, success:aws_bucket.findBucket, failure:failed, error:errored},
    {func:aws_bucket.findBucket, success:aws_topic.findTopic, failure:aws_bucket.createBucket, error:errored},
    {func:aws_bucket.createBucket, success:aws_topic.findTopic, failure:failed, error:errored},
    {func:aws_topic.findTopic, success:aws_config.findRecorders, failure:aws_topic.createTopic, error:errored},
    {func:aws_topic.createTopic, success:aws_config.findRecorders, failure:failed, error:errored},
    {func:aws_config.findRecorders, success:aws_config.setRoleInRecorder, failure:aws_config.setRoleInRecorder, error:errored},
    {func:aws_config.setRoleInRecorder, success:aws_config.findChannels, failure:failed, error:errored},
    {func:aws_config.findChannels, success:aws_config.findRecordersStatus, failure:aws_config.setChannel, error:errored},
    {func:aws_config.setChannel, success:aws_config.findRecordersStatus, failure:failed, error:errored},
    {func:aws_config.findRecordersStatus, success:succeeded, failure:aws_config.startRecorder, error:errored},
    {func:aws_config.startRecorder, success:succeeded, failure:failed, error:errored},
  ];
  aws_sts.flows = flows;
  aws_bucket.flows = flows;
  aws_topic.flows = flows;
  aws_role.flows = flows;
  aws_config.flows = flows;

  flows[0].func(input);
};
