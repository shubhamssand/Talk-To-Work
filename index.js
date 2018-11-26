'use strict';
const functions = require('firebase-functions');
const {WebhookClient} = require('dialogflow-fulfillment');
var jenkins = require('jenkins')({ baseUrl: 'http://<user>:<pass>@ec2-54-87-132-101.compute-1.amazonaws.com:8080', crumbIssuer: true });

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
            console.log(agent.contexts);
            var context = agent.context.get('jenkins-job');
            console.log(context);
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
      return getGithubIssue(agent.parameters.repoNameEntity).then((data) => {
                agent.add(data);
        }).catch((err) => {
            agent.add("Error in connecting to GitHub");
        });        
    }
    
    function githubTopRepos(agent){
    return maxCommitRepo().then((data) => {
        agent.add(data);
      }).catch((err) => {
         agent.add("Error in connecting to GitHub", err);
      });          
    }
    
    function githubIssueDetails(){
    return getDetailedIssueInRepo(agent.parameters.repoNameEntity).then((data) => {
         agent.add(data);
      }).catch((err) => {
          agent.add("Error in connecting to GitHub", err);
      });        
    }
    
    
    let intentMap = new Map();
    intentMap.set('jenkins.status', jenkinsStatus);
    intentMap.set('jenkins.job', jenkinsJobs);    
    intentMap.set('jenkins.job.status', jenkinsJobStatus);
    intentMap.set('jenkins.job.trigger', jenkinsJobTrigger);
    intentMap.set('github.issue', githubIssue);
    intentMap.set('github.topRepos', githubTopRepos);
    intentMap.set('github.issueDetails', githubIssueDetails);

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


function getGithubIssue(github_repo){
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
    }
    });
});
}




function maxCommitRepo(){
    return new Promise((resolve, reject) => {
        
    var sortCommit = [];
    var flag = null;
    var res = "";        
    client.get(`/orgs/${github_org}/repos`, {}, function (err, status, result, headers) {
    if(err){
        reject(err);
    }else{
        let ret = [];
        console.log("Total Repos in org",result.length);

         result.map((data)=>{
            //  console.log("\nRepo Name",);
             var repo_name = data.name;
             // console.log("Last push by repo",data.pushed_at)
             // console.log("Open issue count in a repo",data.open_issues_count)
             // console.log("Open issue in a repo",data.open_issues)
            client.get(`repos/SJSU272LabF18/${repo_name}/commits`, {}, function (err, status, response, headers) {           
                    var max= 0; 
                    var top = [];
                     //console.log("\nTotal commit by repo ",data.name, "->", response.length);
                     var repo_with_commit = {
                        repo_name : data.name,
                        commit : response.length
                     }
                     sortCommit.push(repo_with_commit);
                        if(sortCommit.length === 30){
                            sortCommit.map((repo)=>{
                                if(repo.commit >= max ){
                                    max = repo.commit
                                }
                            })
                            sortCommit.map((repo)=>{
                                if(repo.commit === max ){
                                    top.push(repo.repo_name)
                                }
                            })
                            if(top.length === 1){
                               // console.log("The max commits is done by",top[0]);
                                 var res = `The maximum commit is ${max} is done by ${top}` 
                            resolve(res);

                            }else if(top.length >= 1){
                               // console.log("The max commits are done by "+ top.length + " repositories ",names);
                                var res2 = `The maximum commit is ${max} which is done by ${top.length} repositories ${top}`
                                resolve(res2);
                            }

                            
                        }
                     
                 })        
         })
    }
    });
});
}

function getDetailedIssueInRepo(github_repo){
        // var github_repo = agent.parameters.repo;

        return new Promise((resolve, reject) => {
            var issue_body = [];
            client.get(`/repos/${github_org}/${github_repo}/issues`, {}, function (err, status, result, headers) {
                if(err){
                    reject(err);
                }else{
                        for(var i=0;i<result.length;i++){
                            issue_body.push(result[i].title)
                        }   
                        //resolve(issue_body);
                        if(issue_body.length === 0){
                            console.log(`No issues found in ${github_repo} repositories` );
                            var res = `No issues found in ${github_repo} repositories` 
                            resolve(res);
                        }

                        if(issue_body.length === 1){
                            console.log(`The issue found in ${github_repo} repositories is ${issue_body}` );
                              var res1 = `The issue found in ${github_repo} repositories is ${issue_body}` 
                             resolve(res1);

                         }else if(issue_body.length >= 1){
                            console.log(`The issues in ${github_repo} repositories are ${issue_body}`);
                             var res2 = `The issues in ${github_repo} repositories are ${issue_body}`
                             resolve(res2);
                         }
                }
        
            })
        })
}
