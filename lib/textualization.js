
var util = require('util');
var jshint = require('jshint').JSHINT;
var fs = require('fs');
var sprintf = require("sprintf-js").sprintf;
var vsprintf = require("sprintf-js").vsprintf;
var colors = require('colors');

// t12n\([\'\"]([a-zA-Z_$][0-9a-zA-Z_$\.-]*[0-9a-zA-Z_$]*)[\'\"](?:,(\{.*\}))[,\)]

function Textualization(){
	this.heap = {};
	this.cache = {};
	this.langs = ['en'];
	this.load('pillars','languages');
	console.log(this.t12n('textualization.langs',{langs:this.langs}));
}

Textualization.prototype.languages = function(langs){
	this.langs = langs;
	this.refresh();
	console.log(this.t12n('textualization.langs',{langs:this.langs}));
	return this;
}

Textualization.prototype.refresh = function(){
	this.heap = {};
	for(var i in this.cache){
		this.load(i,this.cache[i]);
	}
	return this;
}

Textualization.prototype.load = function(domain,path){
	this.cache[domain]={};
	for(var l in this.langs){
		var lang = this.langs[l];
		try {
			var source = fs.readFileSync(path+'/'+lang+'.js','utf8');
			source = "this.cache[domain][lang] = {"+source+"};";
			if(!jshint(source)){
				var checkfail = jshint.data().errors;
				var error = new Error("Sheet sintax error");
				error.stack = [];
				for(var e in checkfail){
					error.stack.push((checkfail[e].reason+" in line "+checkfail[e].line));
				}
				throw error;
			}
			eval(source);
			if(this.cache[domain][lang]){
				if(!this.heap[lang]){this.heap[lang]={};}
				for(var i in this.cache[domain][lang]){
					if(this.heap[lang][i]){console.log(this.t12n('textualization.heap-rewrite',{domain:domain,lang:lang,element:i}));}
					this.heap[lang][i]=this.cache[domain][lang][i];
				}
			}
			console.log(this.t12n('textualization.load-ok',{domain:domain,path:path,lang:lang,count:Object.keys(this.cache[domain][lang]).length}));
		} catch(error){
			console.log(this.t12n('textualization.load-error',{domain:domain,path:path,lang:lang}),error.stack);
		}
	}
	this.cache[domain]=path;
	return this;
}

Textualization.prototype.t12n = function(text,params,lang) {
	var lang = lang || this.langs[0];
	var sheet = {};
	var params = params;
	var text = text || "";
	if(this.heap[lang]){
		var sheet = this.heap[lang];
	}

	if(typeof params!=="object"){params = [params];}
	
	text = text.split(".");
	var match = sheet;
	for(var i=0;i<text.length;i++){
		if(i+1<text.length && typeof match[text[i]+"."+text[i+1]] !== "undefined"){
			match = match[text[i]+"."+text[i+1]];
			i++;
		} else if(typeof match[text[i]] !== "undefined"){
			match = match[text[i]];
		} else {
			if(typeof params.bydefault !== "undefined"){return params.bydefault;}
			return text.slice(-2).join('.');
		}
	}
	try {
		if(typeof match==="string"){
			return sformat(match,params);
		} else if(Array.isArray(match) && match.length>=2 && match.length<=3 && params.length>=1 && params[0]>=0){
			if(match.length==2){
				return sformat((params[0]==1)?match[0]:match[1],params);
			} else {
				return sformat((params[0]>=match.length-1)?match[match.length-1]:match[params[0]],params);
			}
			throw new Error("Invalid params");

		} else if(typeof match==="function"){
				var func = functionBody(match);
				func = "function("+Object.keys(params).join(',')+"){\n"+func+"\n}";
				eval("func = "+func+";");
				var funcparams = [];
				for(var p in params){funcparams.push(params[p]);}
				func = func.apply(this,funcparams);
				return sformat(func,params);

		} else if(typeof match==="object") {
			var conditions = Object.keys(match);
			var ok;
			for(var i in conditions){
				condition = conditions[i];
				if(condition==="default"){
					ok=i;break;
				} else if(!/([{}]|[0-9a-zA-Z_$]\()/i.test(condition)){
					var func = "function("+Object.keys(params).join(',')+"){if("+condition+"){return true;} else {return false;}}";
					try {
						eval("func = "+func+";");
						var funcparams = [];
						for(var p in params){funcparams.push(params[p]);}
						func = func.apply(this,funcparams);
						if(func===true){ok=i;break;}
					} catch(error){
						// Condition fail === false, continue.
					}
				} else {
					throw new Error('Condition invalid format: "'+condition+'"');
				}
			}
			if(ok>=0){
				return sformat(match[conditions[ok]],params);
			}
			throw new Error("No condition matches");
		}
		throw new Error("Invalid format");

	} catch(error){
		console.log("Textualization error:\n\tId:",text.join('.'),"\n\tParams:",params,"\n\tError:",error);
		return "Error:"+text.slice(-2).join('.');
	}
}

function sformat(string,params){
	params = stringZeros(params);
	var format = (!params)?string:(params.slice)?vsprintf(string,params):sprintf(string,params);
	return format;
	function stringZeros(o){
		for(var i in o){if(o[i]===0){o[i]="0";}}
		return o;
	}
}

function functionBody(func){
	var source = func.toString();
	var ini = /^\W*function[^{]*{/;
	var end = /\}$/;
	ini = ini.exec(source);
	if(ini){ini = ini.index+ini[0].length;} else {ini = 0;}
	end = end.exec(source);
	if(end){end = end.index;} else {end = source.length;}
	return source.substring(ini,end);
}

/*
function functionExplode(func){
	var source = func.toString();
	var ini = /^\W*function[^{]*{/;
	var end = /\}$/;
	ini = ini.exec(source);
	if(ini){ini = ini.index+ini[0].length;} else {ini = 0;}
	end = end.exec(source);
	if(end){end = end.index;} else {end = source.length;}

	var args = [];
	var argsmatch = source.match(/^\W*function\s*\((.*?)\)\s*{/);
	if (argsmatch === null) {
		argsmatch = source.match(/^\W*function\s*[a-zA-Z_$][0-9a-zA-Z_$]*\s*\((.*?)\)\s*{/);
	}
	if (argsmatch !== null) {
		if (typeof argsmatch[1] !== "undefined" && argsmatch[1] !== "") {
			argsmatch = argsmatch[1];
			args = argsmatch.split(',').map(function(val){return val.trim()});	
		}
	}
	return {
		body:source.substring(ini,end),
		args:args
	};
}
*/

module.exports = new Textualization();