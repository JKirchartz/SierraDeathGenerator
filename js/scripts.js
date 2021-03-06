var canvas = document.querySelector('canvas#death')
var context = canvas.getContext('2d')
var baseImage = null
var fontImage = null
var fontInfo = null
var overlayNames = null
var selectedGenerator = 'pq2'

if(window.location.hash.length > 0){
	selectedGenerator = window.location.hash.substr(1)
}

for(key in generators) {
	if(generators.hasOwnProperty(key)) {
		$('#genlist').append($('<a class="f6 link dim ph3 pv2 mb2 dib white bg-dark-gray"></a>').attr("href",'#'+key).text(generators[key].title).data('generator',key).click(function (){
			selectedGenerator=$(this).data('generator')
			selectGenerator()
		})).append(' ')
	}
}

function isAnyDefaultText(text){
	for(key in generators) {
		if(generators.hasOwnProperty(key)) {
			if(generators[key].defaulttext == text){
				return true
			}
		}
	}
	return false
}

function selectGenerator(){

	var gen=generators[selectedGenerator]
	window.location.hash=selectedGenerator

	$('button.generator-switcher').each(function(){
		$(this).prop('disabled',$(this).data('generator')==selectedGenerator)
	})

	$('.change-title').text(gen.title + " Generator");
	$('.change-source').attr('href',gen.sourceurl).text(gen.source)
	if(gen['contributor']){
		if(gen['contributorurl']){
			$('#extra-contrib').text(' and ').append(
				$('<a>').attr('href',gen['contributorurl']).text(gen['contributor'])
			)
		}else{
			$('#extra-contrib').text(' and ' + gen['contributor'])
		}
	}else{
		$('#extra-contrib').text('')
	}
	var sourcetext = $('#sourcetext');

	if(sourcetext.text().length==0 || isAnyDefaultText(sourcetext.text())){
		$('#sourcetext').text(gen.defaulttext)
	}

	fontInfo=null // Prevent flash of gibberish when switching images
	loadJSONForGenerator()
	$('.source').remove();

	gamesPath = 'games/' + selectedGenerator + '/'
	baseImage = $('<img id="template" class="source" />').attr('src', gamesPath + selectedGenerator + '-blank.png').appendTo('body')[0]
	fontImage = $('<img id="font" class="source" />').attr('src', gamesPath + selectedGenerator + '-font.png').appendTo('body')[0]

	baseImage = null
	$('.source').waitForImages(true).done(function(){
		baseImage=$('img#template')[0]
		//fontImage=$('img#font')[0]
		renderText()
	});


}

function getWidth(lines){

	var maxw=0;
	for (let line of lines){
		var w=0;
		for(var i=0;i<line.length;i++){
			var info=fontInfo[line.charCodeAt(i)]
			if(info==null){
				info=fontInfo[fontInfo["null-character"]]
			}
			w+=info.w
		}
		maxw=Math.max(maxw,w)
	}
	return maxw

}
function getHeight(lines){

	if(lines.length == 0){
		return 0;
	}
	if(fontInfo['first-height'] == null){
		return fontInfo.height * lines.length
	}
	
	return Math.max(0,fontInfo.height * (lines.length-1)) + fontInfo['first-height']

}
function parseOverlays(fontInfo){
	var overlays = {}
	if ('overlays' in fontInfo) {
		for(var i=0;i<overlayNames.length;i++){
			var oname=overlayNames[i]
			var currentOverlay=fontInfo.overlays[oname]
			var stage="pre-text"
			if('stage' in currentOverlay){
				stage=currentOverlay['stage']
			}
			var sname = $('#overlay-'+oname+' option:selected').text()
			var adv=currentOverlay.options[sname]
			var blend='source-over'
			if('blend-mode' in currentOverlay){
				blend = currentOverlay['blend-mode']
			}
			overlays[oname] = {
				"name":sname,
				"x":currentOverlay.x,
				"y":currentOverlay.y,
				"w":adv.w,
				"h":adv.h,
				"blend":blend,
				"stage":stage,
				"source":{
					"x":adv.x,
					"y":adv.y
				}
			}

		}
	}
	return overlays
}

function renderText(scaled = true){
	if(fontInfo == null || baseImage == null){
		return
	}

	var originx=fontInfo.origin.x

	var bx=fontInfo.box.x,by=fontInfo.box.y
	var text = document.querySelector("textarea#sourcetext").value.split('\n')

	var justify = 'left'
	if(fontInfo['justify'] != null){
		justify = fontInfo['justify']
	}
	var textbox={
		w: getWidth(text),
		h: getHeight(text)
	}
	if(justify == 'center-box'){
		originx -= Math.floor(textbox.w/2)
	}

	var overlays = parseOverlays(fontInfo)

	var outputSize={
		w:baseImage.width,
		h:baseImage.height
	}
	if('dynamic-size' in fontInfo){
		outputSize.w = eval(fontInfo['dynamic-size'].w)
		outputSize.h = eval(fontInfo['dynamic-size'].h)
	}
	var buffer = 10
	var browserScale = $(window).width() / (outputSize.w + buffer)

	var fontScale = 2;
	if(fontInfo['scale'] != null){
		fontScale = fontInfo.scale
	}


	var scale = Math.min(browserScale, fontScale)
	if(!scaled){
		scale = fontScale
	}
	context.canvas.width = outputSize.w * scale
	context.canvas.height = outputSize.h * scale
	if(scale == 2.0){
		context.imageSmoothingEnabled = false
	}

	function drawOverlays(stage){
		Object.keys(overlays).forEach(function (key) {
			var adv = overlays[key]
			if(adv.stage == stage){
				context.globalCompositeOperation = adv.blend
				context.drawImage(fontImage,adv.source.x,adv.source.y,adv.w,adv.h,adv.x*scale,adv.y*scale,adv.w*scale,adv.h*scale)
			}
		})
		context.globalCompositeOperation = "source-over"
	}

	// Clear before drawing, as transparents might get overdrawn
	context.clearRect(0, 0, canvas.width, canvas.height)
	context.drawImage(baseImage, 0, 0, baseImage.width*scale, baseImage.height*scale)
	var firstLine=true;

	drawOverlays('pre-border')

	if('border' in fontInfo) {
		var bw=outputSize.w,bh=outputSize.h
		var bx=('x' in fontInfo.border) ? fontInfo.border.x :0
		var by=('x' in fontInfo.border) ? fontInfo.border.y : 0
		if('hooks' in fontInfo && 'border' in fontInfo['hooks']){
			// EVAL IS SAFE CODE, YES?
			eval(fontInfo['hooks']['border'])
		}
		buildBorder(fontImage,fontInfo,bw,bh)
		var bordercanvas = document.querySelector('canvas#border')
		context.drawImage(bordercanvas,0,0,bw,bh,bx*scale,by*scale,bw*scale, bh*scale)
	}

	if('hooks' in fontInfo && 'pre-overlays' in fontInfo['hooks']){
		// EVAL IS SAFE CODE, YES?
		eval(fontInfo['hooks']['pre-overlays'])
	}


	drawOverlays('pre-text')

	var y=fontInfo.origin.y

	if(justify=='v-center'){
		y -= Math.floor(textbox.h/2)
	}
	var fontOriginY=0

	if('hooks' in fontInfo && 'pre-text' in fontInfo['hooks']){
		// EVAL IS SAFE CODE, YES?
		eval(fontInfo['hooks']['pre-text'])
	}

	for (let line of text){
		if(fontInfo['case-fold'] == 'upper'){
			line = line.toUpperCase()
		}else if(fontInfo['case-fold'] == 'lower'){
			line = line.toLowerCase()
		}
		var x=originx
		if(justify == 'center'){
			x = originx - Math.floor(getWidth([line])/2)
		}
		for(var i=0;i<line.length;i++){
			var info=fontInfo[line.charCodeAt(i)]
			if(info==null){
				info=fontInfo[fontInfo["null-character"]]
			}
			bx=info.w
			by=info.h
			context.drawImage(fontImage,info.x,fontOriginY,bx,by,x*scale,y*scale,bx*scale,by*scale)
			x+=info.w
		}
		if(firstLine){
			if(fontInfo['first-height'] != null){
				// remove out fontInfo.height because it's going to be re-added later.
				y+=fontInfo['first-height']-fontInfo.height
			}
			firstLine = false;
		}
		y+=fontInfo.height
	}

}



function buildBorder(fontImage,fontInfo,w,h){

	function drawBorderPiece(x,y,piece){
		bctx.drawImage(fontImage,piece.x,piece.y,piece.w,piece.h,x,y,piece.w,piece.h)
	}
	var bctx = document.querySelector('canvas#border').getContext('2d')
	if(bctx.canvas.width == w && bctx.canvas.height == h){
		return
	}
	bctx.canvas.width = w
	bctx.canvas.height = h
	var border = fontInfo.border
	// todo: support styles other than "copy", like "stretch"

	// Draw center
	if(border.c.mode=='stretch'){
		var piece = border.c
		bctx.drawImage(fontImage,
			piece.x,piece.y,piece.w,piece.h,
			border.l.w,border.t.h,
			w-border.l.w-border.r.w,h-border.b.h-border.t.h
		)
	}else{
		for(var x=border.l.w;x<w-border.r.w;x+=border.c.w){
			for(var y=border.t.h;y<h-border.b.h;y+=border.c.h){
				drawBorderPiece(x,y,border.c)
			}
		}
	}

	// Draw top-center edge
	for(var x=border.tl.w;x<w-border.tr.w;x+=border.t.w){
		drawBorderPiece(x,0,border.t)
	}
	// Draw bottom-center edge
	for(var x=border.bl.w;x<w-border.br.w;x+=border.b.w){
		drawBorderPiece(x,h-border.b.h,border.b)
	}
	// Draw left edge
	for(var y=border.tl.h;y<h-border.bl.h;y+=border.l.h){
		drawBorderPiece(0,y,border.l)
	}
	// Draw right edge
	for(var y=border.tr.h;y<h-border.br.h;y+=border.r.h){
		drawBorderPiece(w-border.r.w,y,border.r)
	}

	// Top-Left corner
	drawBorderPiece(0,0,border.tl)
	// Top-Right corner
	drawBorderPiece(w-border.tr.w,0,border.tr)

	// Bottom-Left corner
	drawBorderPiece(0,h-border.bl.h,border.bl)

	// Bottom-Right corner
	drawBorderPiece(w-border.br.w,h-border.br.h,fontInfo.border.br)

}

function resetOverlays(){

	overlayNames = []
	$('.overlays p').remove()
	if('overlays' in fontInfo){
		var overlays = fontInfo.overlays
		for(key in overlays) {
			if(overlays.hasOwnProperty(key)) {
				overlayNames.push(key)
				var overlay = overlays[key]
				var pwrapper=$("<p>").text(overlay.title+': ')
				if(overlay.title ==''){
					// Internal effect, don't show to the user
					pwrapper.addClass('internal-overlay')
				}
				var select = $('<select class="overlay-selector">').attr('id','overlay-'+key)
				for(opt in overlay.options){
					if(overlay.options.hasOwnProperty(opt)){
						$('<option>').text(opt).prop('selected',opt==overlay['default']).appendTo(select)
					}
				}
				select.appendTo(pwrapper)
				pwrapper.appendTo($('.overlays'))
			}
		}
	}
	$('.overlays select').change(renderText)

}

function loadJSONForGenerator(){

	gamesPath = 'games/' + selectedGenerator + '/'
	$.getJSON(gamesPath + selectedGenerator + ".json",function(data){
		fontInfo = data
		resetOverlays()
		renderText()
	})

}

selectGenerator()
$('#sourcetext').keyup(renderText)
$(window).resize(function () { renderText() });

$('#save').click(function(){
	// generate an unscaled version
	renderText(false)
	this.href=context.canvas.toDataURL('image/png')
	var text = document.querySelector("textarea#sourcetext").value
	text = text.replace(/\n/," ").replace(/[^-._a-zA-Z0-9 ]/,"")
	this.download = selectedGenerator + "-" + text + ".png"
	return true
})