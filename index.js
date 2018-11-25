'use strict';

const functions = require('firebase-functions');
const {WebhookClient} = require('dialogflow-fulfillment');
var jenkins = require('jenkins')({ baseUrl: 'http://admin:SJSU2018@ec2-54-87-132-101.compute-1.amazonaws.com:8080', crumbIssuer: true });

//GitHub Constants
var github = require('octonode');
var github_token = "d48b7b3338d61530444466678a4d57c6ed08452d";
var github_owner = "thevarunjain";
var github_repo = "Project-Team-21";
var github_org = "SJSU272LabF18";
var client = github.client(github_token);


exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
    const agent = new WebhookClient({ request, response });
    function jenkinsStatus (agent){
        return getJenkinsStatus().then((data) => {
            agent.add(data);
        }).catch((err) => {
            agent.add('Jenkins server is unavailable');
        });
    }
    function jenkinsJobs (agent){
        return getJenkinsJobs().then((data) => {
            agent.add(data);
        }).catch((err) => {
            agent.add('Unable to retrieve information about jobs');
        });
    }
    
    function jenkinsJobStatus (agent){
        const jobName = agent.parameters.jobName;
        return getJenkinsJobStatus(jobName).then((data) => {
            agent.add(data);
        }).catch((err) => {
            agent.add('Unable to retrieve information about job');
        });
    }
    
    function jenkinsJobTrigger (agent){
        var jobName = "";
        if (agent.parameters){
            jobName = agent.parameters.jobName;
        }
        console.log(jobName);
        if (!jobName) {
            var context = agent.context.get('jenkins-job');
            if (!context.parameters.jobName){
                return agent.add('Job Name is missing. Sorry.');
            }
        }
        return triggerJenkinsJob(jobName).then((data) => {
            agent.add(data);
        }).catch((err) => {
            agent.add(`Unable to trigger ${jobName}`);
        });
    }
    
    function githubIssue(agent){
      return getGithubIssue().then((data) => {
            agent.add(data);
        }).catch((err) => {
            agent.add("Error in connecting to GitHub");
        });        
    }
    
    let intentMap = new Map();
    intentMap.set('jenkins.status', jenkinsStatus);
    intentMap.set('jenkins.job', jenkinsJobs);    
    intentMap.set('jenkins.job.status', jenkinsJobStatus);
    intentMap.set('jenkins.job.trigger', jenkinsJobTrigger);
    intentMap.set('github.issue', githubIssue);

    agent.handleRequest(intentMap);
});

function triggerJenkinsJob(jobName){
    return new Promise((resolve, reject) => {
        var res = "";
        jenkins.job.get(jobName, function(err, jobInfo) {
            if (err) throw err;
            var buildNumber = jobInfo.nextBuildNumber;
            jenkins.job.build(jobName, function(err, queueItem) {
                if (err) {
                    reject(err);
                }
                res = `New build for ${jobName} triggered with build number ${buildNumber}`;
                resolve(res);
            });
        });
    });
}

function getJenkinsJobStatus(jobName){
    return new Promise((resolve, reject) => {
        var res = "";
        jenkins.job.get(jobName, function(err, jobStatus) {
            if (err) {
                reject(err);
            }
            if (jobStatus.color != 'blue'){
                res = `Jenkins job ${jobName} is in FAILED state`;
            }
            else {
                res = `Jenkins job ${jobName} is in SUCCESSFUL state`;
            }
            resolve(res);
        });
    });
}


function getJenkinsJobs(){
    return new Promise((resolve, reject) => {
        var res = "";
        jenkins.job.list(function(err, jobs) {
            if (err) {
                reject(err);
            }
            var noOfJobs = jobs.length;
            if (noOfJobs === 0){
                res = "There are no jobs configured with Jenkins.";
            }
            else if (noOfJobs === 1){
                res = `Job ${jobs[0].name} is configured with Jenkins.`;
            }
            else {
                res = `There are following ${noOfJobs} jobs configured with Jenkins.\n`;
                for (var i = 0; i < noOfJobs; i++ ){
                    res += `${i+1}. ${jobs[i].name}\n`;
                }
            }
            resolve(res);
        });
    });
}

function getJenkinsStatus(){
    return new Promise((resolve, reject) => {
        var res = "";
        jenkins.info(function(err, info) {
            if (err) {
                reject(err);
            }
            var mode = info.mode;
            res += `Jenkins server is available and operating in ${mode} mode.`;
            jenkins.node.list(function(err, nodeList) {
                if (err) {
                    
                    reject(err);
                }
                var noOfAgents = nodeList.length - 1;
                if (noOfAgents === 0){
                    res += `You may want to configure slaves to make best of it.`;
                } else if (noOfAgents === 1){
                    res += `It's configured with ${noOfAgents} slave.`;
                } else if (noOfAgents > 1){
                    res += `It's configured with ${noOfAgents} slaves.`;
                }
                resolve(res);
            });
        });
    });
}


function getGithubIssue(){
    return new Promise((resolve, reject) => {
    var res = "";
        
    client.get(`/repos/${github_org}/${github_repo}/issues`, {}, function (err, status, result, headers) {
    if(err){
        reject(err);
    }else{
        if(result.length===0){
            res = `No issues found in ${github_repo} repository`;
            resolve(res);
        }else if(result.length===1){
            res=`There is ${result.length} issue in ${github_repo} repository`;
            resolve(res);
        }else if(result.length>=1){
            res=`There are ${result.length} issues in ${github_repo} repository`;
            resolve(res);
        }
        // result.map((data)=>{
        //     console.log(data.state==="open"); //json object
        //         res += data.title;
        // });
    }
    });
});
}
