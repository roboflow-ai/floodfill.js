var parseColor = require('parse-color');

module.exports = function(CanvasRenderingContext2D) {
	//Copyright(c) Max Irwin - 2011, 2015, 2016
	//MIT License

	function floodfill(data,x,y,fillcolor,tolerance,width,height) {
		var length = data.length;
		var Q = [];
		var i = (x+y*width)*4;
		var e = i, w = i, me, mw, w2 = width*4;

		var targetcolor = [data[i],data[i+1],data[i+2],data[i+3]];

		if(!pixelCompare(i,targetcolor,fillcolor,data,length,tolerance)) { return false; }
		Q.push(i);
		while(Q.length) {
			i = Q.pop();
			if(pixelCompareAndSet(i,targetcolor,fillcolor,data,length,tolerance)) {
				e = i;
				w = i;
				mw = parseInt(i/w2)*w2-1; //left bound
				me = mw+w2;             //right bound
				while(mw<w && mw<(w-=4) && pixelCompareAndSet(w,targetcolor,fillcolor,data,length,tolerance)); //go left until edge hit
				while(me>e && me>(e+=4) && pixelCompareAndSet(e,targetcolor,fillcolor,data,length,tolerance)); //go right until edge hit
				for(var j=w+4;j<e;j+=4) {
					if(j-w2>=0     && pixelCompare(j-w2,targetcolor,fillcolor,data,length,tolerance)) Q.push(j-w2); //queue y-1
					if(j+w2<length && pixelCompare(j+w2,targetcolor,fillcolor,data,length,tolerance)) Q.push(j+w2); //queue y+1
				}
			}
		}
		return data;
	}

	function pixelCompare(i,targetcolor,fillcolor,data,length,tolerance) {
		if (i<0||i>=length) return false; //out of bounds
		if (data[i+3]===0 && fillcolor.a>0) return true;  //surface is invisible and fill is visible

		if (
			Math.abs(targetcolor[3] - fillcolor.a)<=tolerance &&
			Math.abs(targetcolor[0] - fillcolor.r)<=tolerance &&
			Math.abs(targetcolor[1] - fillcolor.g)<=tolerance &&
			Math.abs(targetcolor[2] - fillcolor.b)<=tolerance
		) return false; //target is same as fill

		if (
			(targetcolor[3] === data[i+3]) &&
			(targetcolor[0] === data[i]  ) &&
			(targetcolor[1] === data[i+1]) &&
			(targetcolor[2] === data[i+2])
		) return true; //target matches surface

		if (
			Math.abs(targetcolor[3] - data[i+3])<=(255-tolerance) &&
			Math.abs(targetcolor[0] - data[i]  )<=tolerance &&
			Math.abs(targetcolor[1] - data[i+1])<=tolerance &&
			Math.abs(targetcolor[2] - data[i+2])<=tolerance
		) return true; //target to surface within tolerance

		return false; //no match
	}

	function pixelCompareAndSet(i,targetcolor,fillcolor,data,length,tolerance) {
		if(pixelCompare(i,targetcolor,fillcolor,data,length,tolerance)) {
			//fill the color
			data[i]   = fillcolor.r;
			data[i+1] = fillcolor.g;
			data[i+2] = fillcolor.b;
			data[i+3] = fillcolor.a;
			return true;
		}
		return false;
	}

	function fillUint8ClampedArray(data,x,y,color,tolerance,width,height) {
		if (!(data instanceof Uint8ClampedArray)) throw new Error("data must be an instance of Uint8ClampedArray");
		if (isNaN(width)  || width<1)  throw new Error("argument 'width' must be a positive integer");
		if (isNaN(height) || height<1) throw new Error("argument 'height' must be a positive integer");
		if (isNaN(x) || x<0) throw new Error("argument 'x' must be a positive integer");
		if (isNaN(y) || y<0) throw new Error("argument 'y' must be a positive integer");
		if (width*height*4!==data.length) throw new Error("width and height do not fit Uint8ClampedArray dimensions");

		var xi = Math.floor(x);
		var yi = Math.floor(y);

		if (xi!==x) console.warn("x truncated from",x,"to",xi);
		if (yi!==y) console.warn("y truncated from",y,"to",yi);

		//Maximum tolerance of 254, Default to 0
		tolerance = (!isNaN(tolerance)) ? Math.min(Math.abs(Math.round(tolerance)),254) : 0;

		return floodfill(data,xi,yi,color,tolerance,width,height);
	}

	var getComputedColor = function(c) {
		var vals = parseColor(c).rgba;

		var color = {r:0,g:0,b:0,a:0};
		//Coerce the string value into an rgba object
		color.r = parseInt(vals[0])||0;
		color.g = parseInt(vals[1])||0;
		color.b = parseInt(vals[2])||0;
		color.a = parseInt(vals[3])||0;

		return color;
	};

	function fillContext(x,y,tolerance,left,top,right,bottom) {
		var ctx  = this;

		//Gets the rgba color from the context fillStyle
		var color = getComputedColor(this.fillStyle);

		//Defaults and type checks for image boundaries
		left     = (isNaN(left)) ? 0 : left;
		top      = (isNaN(top)) ? 0 : top;
		right    = (!isNaN(right)&&right) ? Math.min(Math.abs(right),ctx.canvas.width) : ctx.canvas.width;
		bottom   = (!isNaN(bottom)&&bottom) ? Math.min(Math.abs(bottom),ctx.canvas.height) : ctx.canvas.height;

		var image = ctx.getImageData(left,top,right,bottom);

		var data = image.data;
		var width = image.width;
		var height = image.height;

		if(width>0 && height>0) {
			fillUint8ClampedArray(data,x,y,color,tolerance,width,height);
			ctx.putImageData(image,left,top);
		}
	}

	function blurEdges(amount) {
		var mult = 1-amount;

		var ctx  = this;

		//Defaults and type checks for image boundaries
		left     = 0;
		top      = 0;
		right    = ctx.canvas.width;
		bottom   = ctx.canvas.height;

		var image = ctx.getImageData(left,top,right,bottom);

		var data = image.data;

		var length = data.length;
		var Q = [];
		var i;
		var w2 = right*4;

		var edges = [];
		for(i=0; i<length; i+=4) {
			if(data[i+3] == 0) {
				// this is a fully transparent pixel
				// so its neighbors are edges
				edges[i-4] = 1;
				edges[i+4] = 1;
				edges[i-w2] = 1;
				edges[i+w2] = 1;
			}
		}

		for(i=0; i<length; i++) {
			// blend the edge
			if(edges[i]) data[i+3] *= mult;
		}

		ctx.putImageData(image,left,top);
	}

	function randomHSL(hAmount, sAmount, lAmount) {
		hAmount = 1+(Math.random()*hAmount*2-hAmount);
		sAmount = 1+(Math.random()*sAmount*2-sAmount);
		lAmount = 1+(Math.random()*lAmount*2-lAmount);

		var ctx  = this;

		//Defaults and type checks for image boundaries
		left     = 0;
		top      = 0;
		right    = ctx.canvas.width;
		bottom   = ctx.canvas.height;

		var image = ctx.getImageData(left,top,right,bottom);

		var data = image.data;

		var length = data.length;
		var i;
		var w2 = right*4;
		var hsl, rgb;

		for(i=0; i<length; i+= 4) {
			// if it's not fully transparent
			if(data[i+3]) {
				hsl = rgbToHsl(data[i], data[i+1], data[i+2]);

				hsl[0] *= hAmount;
				if(hsl[0] > 1) hsl[0] -= 1;
				if(hsl[0] < 0) hsl[0] += 1;

				hsl[1] *= sAmount;
				if(hsl[1] > 1) hsl[1] = 1;
				if(hsl[1] < 0) hsl[1] = 0;

				hsl[2] *= lAmount;
				if(hsl[2] > 1) hsl[2] = 1;
				if(hsl[2] < 0) hsl[2] = 0;

				rgb = hslToRgb(hsl[0], hsl[1], hsl[2]);
				data[i] = rgb[0];
				data[i+1] = rgb[1];
				data[i+2] = rgb[2];
			}
		}

		ctx.putImageData(image,left,top);
	}

	if (typeof CanvasRenderingContext2D != 'undefined') {
		CanvasRenderingContext2D.prototype.fillFlood = fillContext;
		CanvasRenderingContext2D.prototype.blurEdges = blurEdges;
		CanvasRenderingContext2D.prototype.randomHSL = randomHSL;
	}

	return fillUint8ClampedArray;

};

// color conversion code from https://gist.github.com/mjackson/5311256
/**
	 * Converts an RGB color value to HSL. Conversion formula
	 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
	 * Assumes r, g, and b are contained in the set [0, 255] and
	 * returns h, s, and l in the set [0, 1].
	 *
	 * @param   Number  r       The red color value
	 * @param   Number  g       The green color value
	 * @param   Number  b       The blue color value
	 * @return  Array           The HSL representation
 */
function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if (max == min) {
        h = s = 0; // achromatic
    } else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }

        h /= 6;
    }

    return [ h, s, l ];
}

/**
	 * Converts an HSL color value to RGB. Conversion formula
	 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
	 * Assumes h, s, and l are contained in the set [0, 1] and
	 * returns r, g, and b in the set [0, 255].
	 *
	 * @param   Number  h       The hue
	 * @param   Number  s       The saturation
	 * @param   Number  l       The lightness
	 * @return  Array           The RGB representation
 */
function hslToRgb(h, s, l) {
    var r, g, b;

    if (s == 0) {
        r = g = b = l; // achromatic
    } else {
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;

        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return [ r * 255, g * 255, b * 255 ];
}

function hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
}
