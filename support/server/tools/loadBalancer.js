//because the reflector server does not necessarily have to be the same as the file server, we can have the clients
//hit this service to ask what reflector to connect to.
//this system keeps track of requests, so that users alwasy connect to the server that contains the running instance


var libpath = require('path'),
http = require("http"),
fs = require('fs'),
url = require("url"),
express = require('express'),
app = express();
var ServerFeatures = require("../serverFeatures.js");
var logger = require('../logger');
global.configuration = {
    "port": 3001,            
    "loadBalancerKey" : "SECRETKEY",
    "appPath" : null
}


app.use(require('method-override')());

//CORS support
app.use(ServerFeatures.CORSSupport);

//i18n support
app.use(require('cookie-parser')());

//Wait until all data is loaded before continuing
//app.use (ServerFeatures.waitForAllBody);
app.use(require('body-parser').json({
    maxFieldsSize: 16 * 1024 * 1024 * 1024,
    limit: '50mb'
}));
app.use(require('body-parser').urlencoded({
    extended: true
}));
app.use(require('multer')());



//app.use(app.router);


function Host(url)
{
	this.url = url;
	this.instances = [];
	this.add = function(instance)
	{
		if(this.instances.indexOf(instance) == -1)
		this.instances.push(instance);
		logger.info(this.instances);
	}
	this.remove = function(instance)
	{
		logger.info(this.instances);
		this.instances.splice(this.instances.indexOf(instance),1);
		logger.info(this.instances);
	}
	this.contains = function(instance)
	{
		return this.instances.indexOf(instance) != -1;
	}
	this.healthCheck = function()
	{
		require('request').get(this.url+"/admin/instances",function(error,response,body)
		{
			//remember, servers using the cache-busting version number will 302
			if(!error && (response.statusCode == 200 ||  response.statusCode == 302))
			{
				logger.info(this.url + " health check ok.");
				global.setTimeout(this.healthCheck.bind(this),3000);
				body = JSON.parse(body);
				var reportedInstances = Object.keys(body)
				for(var i =0; i < reportedInstances.length; i++)
				{
					if(this.instances.indexOf(reportedInstances[i]) == -1)
					{
						this.add(reportedInstances[i]);
						logger.info(this.url + ' reports untracked instance ' + reportedInstances[i]);
					}
				}
				for(var i = 0; i < this.instances.length; i++)
				{
					if(reportedInstances.indexOf(this.instances[i]) == -1)
					{
						logger.info(this.url + ' reports closing instance ' + this.instances[i]);
						this.remove(this.instances[i]);

					}
				}

			}else
			{
				//remove this from the list of instances
				logger.info(this.url + " health check failed. Removeing.");
				removeHost(this.url);
			}
			
		}.bind(this));
	}
	global.setTimeout(this.healthCheck.bind(this),3000);
}

var hosts = [];


app.get('/',function(req,res,next){
	var instance = (req.query.instance);
	if(global.configuration.appPath)
	{
		instance = instance.replace(global.configuration.appPath,"/adl/sandbox");
	}

	logger.info(instance);
	instance=instance.replace(/\//g,"_");
	for(var i =0; i < hosts.length; i++)
	{
		if(hosts[i].contains(instance))
		{
			logger.info("host " + hosts[i].url + " contains " + instance);
			res.writeHead(200,{'Cache-Control':'no-cache'});
			res.write(hosts[i].url);
			res.end();
			return;
		}
	}
	//if got here, pick random host
	var i = Math.floor((Math.random() -.00001) * hosts.length);
		res.writeHead(200,{'Cache-Control':'no-cache'});
			res.write(hosts[i].url);
			res.end();

	hosts[i].add(instance);		
	logger.info("randomly assign host " + hosts[i].url + " to " + instance);			

})

app.get('/register',function(req,res,next){
	var host = (req.body);
	if(host.key == global.configuration.loadBalancerKey)
	{
		
		var found = -1;
		for(var i =0; i < hosts.length; i++)
		{
			if(hosts[i].url == host.host)
				found = i;
		}
		if(found == -1)
		{
			global.setTimeout(function(){

				require('request').get(host.host+"/admin/instances",function(error,response,body)
				{
					if(!error && (response.statusCode == 200 ||  response.statusCode == 302)) {
						hosts.push(new Host(host.host));
						logger.info(host.host + " registration successful");
					}else
					{
						logger.info(host.host + " does not seem to be visible");
						logger.info(response);
					}

				})
				

			},2000); //give 2 seconds to finish starting up
			
		}
		else
			logger.info("Already have entry for "+ host.host);
	}else
	{
		logger.info('failed registration');
	}
	res.end();
})

function removeHost(url)
{
	var found = -1;
		for(var i =0; i < hosts.length; i++)
		{
			if(hosts[i].url == url)
				found = i;
		}
		if(found != -1)
			hosts.splice(found,1);
}

app.get('/deregister',function(req,res,next){
	var host = (req.body);
	if(host.key == global.configuration.loadBalancerKey)
	{
		logger.info('deregistered '+ host.host);
		removeHost(host.host);
	}else
	{
		logger.info('failed deregistration');
	}
})

app.listen(global.configuration.port);