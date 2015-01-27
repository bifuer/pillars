var logger = global.logger.pillars.plugins.addGroup('CORS');

module.exports = new Plugin({id:'CORS',priority:1002},function(gw,next){
	if(gw.origin){
		var cors =gw.routing.check('cors',ENV.server.cors);
		if(cors===true || (Array.isArray(cors) && cors.indexOf(gw.origin)>-1)){
			gw.cors.origin = gw.origin;
			gw.cors.credentials = true;
			gw.cors.methods = gw.beam.method.concat(['OPTIONS','HEAD']);
		}
	}
	next();
});