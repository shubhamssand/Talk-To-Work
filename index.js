'use strict';
const functions = require('firebase-functions');
const {WebhookClient} = require('dialogflow-fulfillment');
var jenkins = require('jenkins')({ baseUrl: 'http://admin:SJSU2018@ec2-54-87-132-101.compute-1.amazonaws.com:8080', crumbIssuer: true });
var request = require('request');

//GitHub Constants
var github = require('octonode');
var github_token = "7668994a1dab506216e22c26da98826769b62e31";
var github_owner = "thevarunjain";
var github_repo = "Project-Team-21";
var github_org = "SJSU272LabF18";
var client = github.client(github_token);

//JIRA Constants
var options = {
   method: 'GET',
   url: 'https://cmpe272.atlassian.net/rest/agile/1.0/epic/SJSU-10/issue',
   auth: { username: 'mayur.barge@sjsu.edu', password: '4oNotFMGrXuCUQeGjEUhEC10' },
   headers: {
      'Accept': 'application/json'
   }
};

//SPLUNK Constants
var splunkjs = require('splunk-sdk');
var service = new splunkjs.Service({
    username: "admin",
    password: "Vandana$5657",
    scheme:"https",
    host:"52.8.36.104",
    port:"8089"
  });
var searchQuery = " search host=ec2-34-205-23-63.compute-1.amazonaws.com | spath job_result | search job_result=FAILURE"



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
    function githubCommits(){
    return getLastCommits(agent.parameters.repoNameEntity,agent.parameters.number).then((data) => {
         agent.add(data);
      }).catch((err) => {
          agent.add("Error in connecting to GitHub", err);
      });        
    }
    
    
    
    
    
    
    //JIRA Functions
    function issueToBacklog(){
        return moveissueToBacklog(agent.parameters.issue).then((data) => {
             agent.add(data);
          }).catch((err) => {
              agent.add("Error in connecting to GitHub", err);
          });        
    }
    
    function stories (agent){
        return aggregateNames(agent.parameters.usernames).then((data) => {
        //var count=0;
        agent.add(data);
        }).catch((err) => {
            agent.add('JIRA server is unavailable');
        });
    }
    
    //SPLUNK Functions
    function splunkStatus (agent){
        return getSplunkStatus().then((data) => {
            var count=0;
            var appsList = data.list();
            for(var i = 0; i < appsList.length; i++) {
                var app = appsList[i];
                count+=1;
            }
            agent.add(`Splunk is up and runing and has ${count} apps running.And yeah I can help you with logs information.`);
        }).catch((err) => {
            agent.add('Splunk server is unavailable');
        });
    }
    
    
    function splunkQuery (agent){
        return getSplunkQuery(agent.parameters.date[0],agent.parameters.date[1]).then((data) => {
            if(data===0){
            agent.add(`Jenkins Sever has no failed builds`);
            }else{
                agent.add(`Jenkins Sever had  ${data} builds failed.`);
            }
        }).catch((err) => {
            agent.add('Jenkins Sever has no failed builds');
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
    intentMap.set('github.lastCommits', githubCommits);
    
    intentMap.set('jira.moveIssueToBacklog', issueToBacklog);
    intentMap.set('jira.stories', stories);

    intentMap.set('splunk.Status', splunkStatus);
    intentMap.set('splunk.time', splunkQuery);

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


function getLastCommits(github_repo, number){
        // var github_repo = agent.parameters.repo;
        var n=number;
        var last_commits = [];
        var names = '';
        return new Promise((resolve, reject) => {
            var issue_body = [];
            client.get(`/repos/${github_org}/${github_repo}/commits`, {}, function (err, status, result, headers) {
                if(err){
                    reject(err);
                }else{
                    for(var i=0;i<=n-1;i++){
                        last_commits.push(result[i].commit.author)
                    }
                    var value;
                    last_commits.map((com,i)=>{   
                         value = names + com.name + " ";
                         value = value + "on"  + " "
                         value = value + com.date.slice(0,10) + " at " 
                         names = value + com.date.slice(11,16) + ", " 
                    })
                    var data = `Last ${n} commits for ${github_repo} are done by ${names} ` 
                   resolve(data);
                }
            })
        })
}












function moveissueToBacklog(issue){
      //    "SJSU-12"
    var issue_num = issue;
    var bodyData = `{
        "issues": [

        ]
      }`;
      console.log(JSON.parse(bodyData))
      var newIssue = JSON.parse(bodyData);
      console.log(".........",newIssue.issues)
      newIssue.issues.push(issue_num)
      console.log(".........",newIssue.issues)
      console.log(newIssue)
        bodyData = JSON.stringify(newIssue)      
        console.log(bodyData)
      

    var options = {
        method: 'POST',
        url: 'https://cmpe272.atlassian.net/rest/agile/1.0/backlog/issue',
        auth: { username: 'mayur.barge@sjsu.edu', password: '4oNotFMGrXuCUQeGjEUhEC10' },
        headers: {
       //  "Authorization" : "Basic 4oNotFMGrXuCUQeGjEUhEC10",
           'Content-Type': 'application/json'
        },
        body: bodyData
     };

    return new Promise((resolve, reject) => {
            request(options, function (err, response, body) {
            if(err){
                reject(err);
            }else{
                console.log('Response: '+ response.statusCode);
                console.log(body);
               
                var data = `Issue ${issue_num} has been moved to backlog`
                resolve(data);
            }
        })
    })
}

//JIRA

let a=['abhishek.konduri','varun.jain','shubhamsandeep.sand','mayur.barge']
function aggregateNames(name){
    var obj={};
    return new Promise((resolve, reject) => {
        request(options, function (error, response, body) {
            if (error) {reject(error)}
            //    console.log(
            //       'Response: ' + response.statusCode + ' ' + response.statusMessage
            //    );
            let temp=JSON.parse(body);
            //console.log(temp.issues[0]);
            var count=0;
            for (var i=0 ;i<temp.issues.length;i++){
                if(temp.issues[i].fields.assignee.name.includes(name)){
                    count+=1
                }
            }
            //console.log(temp.issues[0].fields.assignee.name);
            var show=`${name} has ${count} number of stories assigned`
            resolve(show);
            //resolve(` this user ${name} `+ count);
        });
    })
}

//SPLUNK 

function getSplunkStatus(){
    return new Promise((resolve, reject) => {
        var res = "";
        service.login(function(err, success) {
            if (err) {
                console.log("err-------------")
                reject(err);
            }
            console.log("Login was successful: " + success);
            service.apps().fetch(function(err, apps) {
                if (err) {
                    reject(err);
                }
                resolve(apps);
            });
        });
        
    });
}


function getSplunkQuery(a,b){
    return new Promise((resolve, reject) => {
        var res = "";
        var searchParams = {
            earliest_time: new Date(a),
            latest_time: new Date(b),
            //output_mode: "json_rows"
        };
        service.oneshotSearch(
            searchQuery,
            searchParams,
            function(err, results) {
                // Display the results
                if(err)
                {
                    reject(err)
                }
                var fields = results.fields;
                var rows = results.rows;
                var count=0;
                for(var i = 0; i < rows.length; i++) {
                    var values = rows[i];
                    console.log("Row " + i + ": ");
                    var data1="";
                    for(var j = 0; j < values.length; j++) {
                        var field = fields[j];
                        var value = values[j];
                        if(field=='_raw'){
                            count+=1;
                        }
                        // console.log("  " + field + ": " + value);
                    }
                }
                resolve(count);
            }
        );
    });
}
