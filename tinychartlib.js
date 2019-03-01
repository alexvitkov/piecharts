
export default (function () {
    var THEME_DEFAULTS = {
        animated: true,
        animInterpolateInDuration: .05,
        animInterpolateOutDuration: .15,
        animInterpolateInFunc: function (t) { return t * t * (3 - 2 * t); },
        animInterpolateOutFunc: function (t) { return t * t * (3 - 2 * t); },

        colors: ['#b7d957', '#fac364', '#8cd3ff', '#d998cb', '#f2d249', '#f2d249', '#93b9c6', '#ccc5a8', '#52bacc', '#dbdb46'],
        textColorOnChart: 'white',
        fontOnChart: 'bold 25px Arial',
        textColor: '#000000',

        showLegend: true,
        legendFont: 'bold 20px Arial',
        legendWidth: 175,
        legendRectWidth: 35,
        legendRectHeight: 25,
        legendSpacing: 5,
        legendHoverElementOffset: -20,
        legendTextYOffset: 3,

        showPercentage: true,
        pieChartPercentageDistance: 0.85,
        pieChartBorderAngle: .4,
        pieChartHoverPopDistance: 18,
    }

    /// Helper vector2 class for the draw methods
    class v2 {
        constructor(x, y) {
            this.x = x;
            this.y = y;
        }
        static aroundCircle(dist, ang, center) {
            return v2.add(new v2(Math.cos(ang) * dist, Math.sin(ang) * dist), center);
        }
        static add(lhs, rhs) {
            return rhs ? new v2(lhs.x + rhs.x, lhs.y + rhs.y) : new v2(lhs.x, lhs.y);
        }
        static sub(lhs, rhs) {
            return rhs ? new v2(lhs.x - rhs.x, lhs.y - rhs.y) : new v2(lhs.x, lhs.y);
        }
        sqrMagnitude() {
            return this.x * this.x + this.y * this.y;
        }
        ang() {
            var a = Math.atan2(this.y, this.x);
            if (a < 0) { a += Math.PI * 2; }
            return a;
        }
    }

    /// Base abstract class for all charts
    class Chart {
        constructor(data, canvas, themeOverrides) {
            this.data = data;
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.theme = themeOverrides || 0;
            this.cursor = new v2(0, 0);
            this.hoverElement = -1;
            this.positions = [];
            this.lastTime = -1;
            this.dt = 0;

            this.canvas.addEventListener('mousemove',
                function (evt) {
                    var rect = this.canvas.getBoundingClientRect();
                    this.cursor.x = evt.clientX - rect.left;
                    this.cursor.y = evt.clientY - rect.top;
                }.bind(this)
            );
            this.draw();
        }

        /// Get a value from the chart's theme or from the default fallback theme if value is missing
        thm(val) {
            return this.theme[val] === undefined ? THEME_DEFAULTS[val] : this.theme[val];
        }

        // Get the color of the i-th element
        getColor(i) {
            return this.thm('colors')[i % this.thm('colors').length];
        }

        draw() {
            // Draw chart
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            var chartW = this.canvas.width;
            if (this.thm('showLegend')) {
                chartW -= this.thm('legendWidth');
                this.drawLegend(this.canvas.width - this.thm('legendWidth'), 0, this.thm('legendWidth'), this.canvas.height, this.canvas.getContext('2d'));
            }
            this.drawChart(0, 0, chartW, this.canvas.height, this.canvas.getContext('2d'));

            // Animate
            if (this.thm('animated')) {
                // Calculate delta time for animations
                var newTime = performance.now();
                if (this.lastTime > 0) {
                    this.dt = (newTime - this.lastTime) / 1000;
                }
                this.lastTime = performance.now();

                // Recalculate positions
                for (var i in this.data) {
                    if (this.positions[i] === undefined) {
                        this.positions[i] = 0;
                    }
                    if (this.hoverElement == i) {
                        this.positions[i] += this.dt / this.thm("animInterpolateInDuration");
                        if (this.positions[i] > 1) this.positions[i] = 1;
                    }
                    else {
                        this.positions[i] -= this.dt / this.thm("animInterpolateOutDuration");
                        if (this.positions[i] < 0) this.positions[i] = 0;
                    }
                }

                // Next frame
                requestAnimationFrame(this.draw.bind(this));
            }

        }

        drawLegend(startX, startY, w, h) {
            this.ctx.textAlign = 'left';
            this.ctx.font = this.thm('legendFont');
            var lineHeight = this.thm('legendRectHeight') + this.thm('legendSpacing');

            startX -= this.thm('legendHoverElementOffset');
            startY += h / 2 - this.data.length * lineHeight / 2;

            for (var i in this.data) {
                var sx = startX + (this.hoverElement === i ? this.thm('legendHoverElementOffset') : 0);
                this.ctx.fillStyle = this.getColor(i);

                // Draw the square that shows the element color
                this.ctx.fillRect(
                    sx,
                    startY + i * lineHeight,
                    this.thm('legendRectWidth'),
                    this.thm('legendRectHeight')
                );

                // Draw the text
                this.ctx.fillText(this.data[i].name,
                    sx + this.thm('legendRectWidth') + this.thm('legendSpacing'),
                    startY + lineHeight * i + this.thm('legendRectHeight') / 2 + this.thm('legendTextYOffset')
                );
            }
        }
    }


    class PieChart extends Chart {
        drawChart(startX, startY, width, height) {
            this.ctx.textAlign = 'center';
            this.hoverElement = -1;

            // Calculate radius. Decrease it if needed to make sure all elements of the chart fall inside the canvas
            var radius = Math.min(width, height) / 2;
            if (this.thm('pieChartPercentageDistance') > 1) { radius /= this.thm('pieChartPercentageDistance'); }
            if (this.thm('animated')) { radius -= this.thm('pieChartHoverPopDistance'); }

            var dataSum = this.data.reduce((acc, o) => acc + o.value, 0);
            var center = new v2(startX + width / 2, startY + height / 2);
            var startAngle = 0.0;
            var mouseAngle = v2.sub(this.cursor, center).ang();
            var pieChartBorderAngle = this.thm('pieChartBorderAngle') * Math.PI / 180;

            for (var i in this.data) {
                var fraction = this.data[i].value / dataSum;
                var endAngle = startAngle + fraction * 2 * Math.PI;
                var centerAngle = (startAngle + endAngle) / 2;

                // Sine theorem to calc where the element should start so the spacing between elements is constant
                var distFromCenter = radius * Math.sin(pieChartBorderAngle) / Math.sin((endAngle - startAngle) / 2);

                // If chart is animated, check if we're hovering the elemnent with the mouse
                if (this.thm("animated")) {
                    var elementOffset = new v2(0, 0);
                    var mouseDistFromCenter = v2.sub(this.cursor, center).sqrMagnitude();
                    var pos = this.positions[i];

                    if (startAngle < mouseAngle && endAngle > mouseAngle && mouseDistFromCenter < radius * radius) {
                        this.hoverElement = i;
                        pos = this.thm("animInterpolateInFunc")(pos);
                    }
                    else {
                        pos = this.thm("animInterpolateOutFunc")(pos);
                    }

                    var add = pos * this.thm('pieChartHoverPopDistance');
                    elementOffset = v2.aroundCircle(add, centerAngle);
                    distFromCenter += add;
                }

                // Draw the pie slice
                var startPoint = v2.aroundCircle(distFromCenter, centerAngle, center);
                this.ctx.beginPath();
                this.ctx.moveTo(startPoint.x, startPoint.y);
                this.ctx.arc(center.x + elementOffset.x, center.y + elementOffset.y, radius, startAngle + pieChartBorderAngle, endAngle - pieChartBorderAngle);
                this.ctx.fillStyle = this.getColor(i);
                this.ctx.fill();

                // Draw the percentage
                if (this.thm('showPercentage')) {
                    this.ctx.font = this.thm('fontOnChart');
                    this.ctx.fillStyle = this.thm('textColorOnChart');
                    var textPoint = v2.add(v2.aroundCircle(radius * this.thm('pieChartPercentageDistance'), centerAngle, center), elementOffset);
                    this.ctx.fillText(Math.round(fraction * 100) + '%', textPoint.x, textPoint.y);
                }

                // Prepare the start angle for the next pie slice
                startAngle = endAngle;
            }
        }
    }

    return {
        PieChart: PieChart,
    }

})();
