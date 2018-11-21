'use strict';

const functions = require('firebase-functions');
const {WebhookClient} = require('dialogflow-fulfillment');
var jenkins = require('jenkins')({ baseUrl: 'http://<username>:<password>@ec2-54-167-103-17.compute-1.amazonaws.com:8080', crumbIssuer: true });

//GitHub Constants
var github = require('octonode');
var github_token = "";
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
    function githubUsers (agent){
        return getJenkinsJobs().then((data) => {
            agent.add(data);
        }).catch((err) => {
            agent.add('Unable to retrieve information about jobs');
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
    intentMap.set('jenkins.jobs', jenkinsJobs);
    intentMap.set('github.issue', githubIssue);
    agent.handleRequest(intentMap);
});

function getJenkinsJobs(){
    return new Promise((resolve, reject) => {
        var res = "";
        jenkins.job.list(function(err, jobs) {
            if (err) {
                reject(err);
            }
            var noOfJobs = jobs.length;
            var failedJobs = 0;
            for (var i = 0; i < noOfJobs; i++){
                if (jobs[i].color != 'blue'){
                    failedJobs += 1;
                }
            }
            if (noOfJobs > 0){
                res = "There are no jobs connfigured with Jenkins.";
            }
            else {
                res = `There are ${noOfJobs} jobs connfigured with Jenkins.`;
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

function getGithubuser(){
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