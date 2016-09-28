
var AWS = require('aws-sdk');

function IAMFederation() {

  var me = this;

  me.deploy = function(input, callback) {
    getRole(input, function(err, data) {
      if(err) callback(err, null);
      else {
        addStatement(input, callback);
      }
    });
  }

  me.clean = function(input, callback) {
    getRole(input, function(err, data) {
      if(err) callback(err, null);
      else {
        removeStatement(input, callback);
      }
    });
  }

  me.build = function(action, packageJSON, callback) {
    var input = {
      region: packageJSON.Region,
      roleArn: packageJSON.RoleArn,
      federationRoleName: packageJSON.FederationRoleName
    };
    console.log(input);
    me[action](input, callback);
  }
}

function findService(input) {
  var params = {region: input.region};
  if (input.creds)  params.credentials = input.creds;
  var iam = new AWS.IAM(params);
  return iam;
}

function getRole(input, callback) {
  var iam = findService(input);
  var params = {
    RoleName: input.federationRoleName
  };
  console.log('findRole : ' + JSON.stringify(params));
  iam.getRole(params, function(err, data) {
    if (err) {
      console.log(err, err.stack);
      callback(err, null);
    }
    else {
      //console.log(data);
      input.assumeDoc = JSON.parse(unescape(data.Role.AssumeRolePolicyDocument));
      callback(null, input);
    }
  });
}

function addStatement(input, callback) {
  var assumeDoc = input.assumeDoc;
  var federationRoleName = input.federationRoleName;
  var lambdaRoleArn = input.roleArn;

  console.log(assumeDoc.Statement);
  var statements = assumeDoc.Statement.filter(function(statement) {
    if (! statement.Effect == 'Allow' && ! statement.Action == 'sts:AssumeRole'){
        return false;
    }
    var s = statement.Principal.AWS;
    if(typeof(s) == "string"){
        if(lambdaRoleArn == s) return true;
        else return false;
    }
    for (var idx = 0 ; idx < s.length ; idx ++){
        if (lambdaRoleArn == s[idx]){
            return true;
        }
    }
  });

  console.log(statements.length);
  if (statements.length == 0) {
    // pick the first statement and append to it
    var assumeStatement = assumeDoc.Statement[0].Principal.AWS;

    if(typeof(assumeStatement) == "string"){
        assumeStatement = [assumeStatement];
    }
    assumeStatement.push(lambdaRoleArn);
    assumeDoc.Statement[0].Principal.AWS = assumeStatement;
    console.log("assumeDoc = " + JSON.stringify(assumeDoc));
    updateAssumeRolePolicy(input, callback);
  }
  else {
    console.log("policy was already added to 'federate' role  for '" + lambdaRoleArn + "'");
    callback(null, true);
  }
}

function removeStatement(input, callback) {
  var assumeDoc = input.assumeDoc;
  var federationRoleName = input.federationRoleName;
  var lambdaRoleArn = input.roleArn;
  console.log(assumeDoc.Statement);
  console.log(input.roleArn);
  var found = -1;
  var assumeStatement = assumeDoc.Statement[0].Principal.AWS;
  for (var i = 0; i < assumeStatement.length; i++) {
    if (assumeStatement[i] == lambdaRoleArn) {
      found = i;
      break;
    }
  }
  if (found < 0) {
      for (var i = 0; i < assumeDoc.Statement.length; i++) {
          if (assumeDoc.Statement[i].Principal.AWS == lambdaRoleArn) {
              found = i;
              break;
          }
      }
  }
  if (found >= 0) {
    assumeStatement.splice(found, 1);
    console.log(assumeStatement);
    updateAssumeRolePolicy(input, callback);
  }
  else {
    console.log("policy was already removed from 'federate' role for '" + lambdaRoleArn + "'");
    callback(null, true);
  }
}

function updateAssumeRolePolicy(input, callback) {
  var iam = findService(input);
  var params = {
    PolicyDocument: JSON.stringify(input.assumeDoc),
    RoleName: input.federationRoleName
  };
  console.log('updateAssumeRolePolicy : ' + JSON.stringify(params));
  iam.updateAssumeRolePolicy(params, function(err, data) {
    if (err) {
      console.log(err, err.stack);
      callback(err, null);
    }
    else {
      console.log(data);
      callback(null, true);
    }
  });
}

module.exports = IAMFederation
