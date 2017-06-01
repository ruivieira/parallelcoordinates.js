var ParallelCoordinates;
(function (ParallelCoordinates_1) {
    var ParallelCoordinates = (function () {
        function ParallelCoordinates(data, options) {
            var _this = this;
            this.keys = [];
            this.totals = {};
            this.WIDTH = Math.round(window.innerWidth * (window.innerWidth <= 960 ? 1 : 0.8));
            this.HEIGHT = Math.min(Math.max(Math.round(window.innerHeight - 150), 420), 600);
            this.margins = {
                left: 20,
                right: 30,
                top: 30,
                bottom: 30
            };
            this.padding = {
                left: 70,
                right: 30,
                top: 20,
                bottom: 0
            };
            this.extents = {};
            this.scale_type = options.scale || "linear";
            this.options = options;
            for (var _i = 0, data_1 = data; _i < data_1.length; _i++) {
                var d = data_1[_i];
                this.keys.push(d["key"]);
            }
            for (var _a = 0, data_2 = data; _a < data_2.length; _a++) {
                var d = data_2[_a];
                if (!this.totals[d["key"]]) {
                    this.totals[d["key"]] = {
                        key: d["key"]
                    };
                }
                this.totals[d["key"]][d["type"]] = d["total"];
            }
            this.nested_data = this.nestData(d3.values(this.totals));
            this.marker_width = [
                2,
                (this.WIDTH - d3.sum([this.margins.left, this.margins.right, this.padding.left, this.padding.right])) / this.options.columns.length
            ];
            this.tooltip = d3.select(options.container)
                .select("#tooltip");
            this.svg = d3.select(options.container)
                .style("width", this.WIDTH + "px")
                .append("svg")
                .attr("width", this.WIDTH)
                .attr("height", this.HEIGHT);
            var defs = this.svg.append("defs")
                .append("pattern")
                .attr({
                id: "diagonalHatch",
                width: 3,
                height: 3,
                patternTransform: "rotate(-45 0 0)",
                patternUnits: "userSpaceOnUse"
            });
            defs.append("rect")
                .attr({
                x: 0,
                y: 0,
                width: 3,
                height: 3
            })
                .style({
                stroke: "none",
                fill: "#fff"
            });
            defs.append("line")
                .attr({
                x0: 0,
                y1: 0,
                x2: 0,
                y2: 3
            })
                .style({
                stroke: "#4040e8",
                "stroke-opacity": 1,
                "stroke-width": 1
            });
            this.xscale = d3.scale.ordinal().domain(options.columns).rangePoints([0, this.WIDTH - (this.margins.left + this.margins.right + this.padding.left + this.padding.right)]);
            this.yscales = {};
            this.width_scales = {};
            this.yAxes = {};
            this.updateScales();
            var left = this.margins.left + this.padding.left;
            var top = this.margins.top + this.padding.top;
            this.keys_group = this.svg.append("g")
                .attr("id", "keys")
                .attr("transform", "translate(" + left + "," + top + ")");
            this.labels_group = this.svg.append("g")
                .attr("id", "labels")
                .attr("transform", "translate(" + left + "," + top + ")");
            this.columns = this.svg.append("g")
                .attr("id", "columns")
                .attr("transform", "translate(" + left + "," + top + ")");
            this.addAxes();
            this.labels = this.labels_group.selectAll("g.labels")
                .data(this.nested_data, function (d) {
                return d.key;
            })
                .enter()
                .append("g")
                .attr("class", "labels")
                .attr("rel", function (d) {
                return d.key;
            })
                .on("click", function (d) {
                var target = (d3.event);
                var $this = d3.select(target.currentTarget);
                $this.classed("highlight", !($this.classed("highlight")));
                _this.keys_group
                    .selectAll("g.key[rel='" + d.key + "']")
                    .classed("highlight", $this.classed("highlight"));
                console.log(d.key);
            })
                .on("mouseover", function (d) {
                var target = (d3.event);
                var $this = d3.select(target.currentTarget);
                $this.classed("hover", true);
                _this.keys_group
                    .selectAll("g.key[rel='" + d.key + "']")
                    .classed("hover", true);
            })
                .on("mouseout", function (d) {
                _this.svg.selectAll("g.hover")
                    .classed("hover", false);
            });
            var key = this.keys_group.selectAll("g.key")
                .data(this.nested_data, function (d) {
                return d.key;
            })
                .enter()
                .append("g")
                .attr("class", "key")
                .attr("rel", function (d) {
                return d.key;
            });
            this.line = d3.svg.line()
                .x(function (d, i) {
                return d['x'];
            })
                .y(function (d, i) {
                if (d['y'] === 0) {
                    return _this.yscales[options.use[d['col']] || d['col']].range()[0];
                }
                return _this.yscales[options.use[d['col']] || d['col']](d['y']);
            });
            this.createKeys(key);
            this.updateConnections(-1);
            this.updateMarkers(-1);
            this.updateLabels(-1);
            this.updateKeyLabels(-1);
        }
        ParallelCoordinates.prototype.nestData = function (data) {
            var _this = this;
            return d3.nest()
                .key(function (d) {
                return d['key'];
            })
                .rollup(function (leaves) {
                var r = {};
                console.log(_this.options.columns);
                var _loop_1 = function (col) {
                    r[col] = d3.sum(leaves, function (o) {
                        return o[col];
                    });
                    r['key'] = leaves[0]["key"];
                };
                for (var _i = 0, _a = _this.options.columns; _i < _a.length; _i++) {
                    var col = _a[_i];
                    _loop_1(col);
                }
                return r;
            })
                .entries(data)
                .filter(function (d) {
                return d.key != "null";
            })
                .sort(function (a, b) {
                return d3.descending(a.values[_this.options.use["name"]], b.values[_this.options.use["name"]]);
            })
                .slice(0, 28);
        };
        ParallelCoordinates.prototype.updateScales = function () {
            var _this = this;
            this.extents = {};
            this.options.columns.forEach(function (d, i) {
                _this.extents[d] = d3.extent(_this.nested_data, function (o) {
                    if (_this.options.dimensions.indexOf(d) > -1) {
                        return o.values[d];
                    }
                    return o.values[d] / o.values[_this.options.ref];
                });
            });
            this.scales = {};
            this.wscales = {};
            var _loop_2 = function (d) {
                var use = this_1.options.use[d] || d;
                if (this_1.options.scale_map[d] == "ordinal") {
                    var inc_1 = 0.000001;
                    this_1.scales[d] = d3.scale.ordinal()
                        .domain(this_1.nested_data.filter(function () {
                        return true;
                    }).sort(function (a, b) {
                        var sorting = _this.options.sorting[use] || d3.ascending;
                        if (a.values[use] == b.values[use]) {
                            if (d3.ascending(a.key, b.key) > 1) {
                                a.values[use] += inc_1;
                            }
                            else {
                                b.values[use] += inc_1;
                            }
                            inc_1 += inc_1;
                        }
                        var __a = (a.values[use]), __b = (b.values[use]);
                        if (_this.options.dimensions.indexOf(d) == -1) {
                            __a = (a.values[use] / ((_this.options.dimensions.indexOf(use) > -1) ? 1 : a.values[_this.options.ref]));
                            __b = (b.values[use] / ((_this.options.dimensions.indexOf(use) > -1) ? 1 : b.values[_this.options.ref]));
                        }
                        return sorting(__a, __b);
                    }).map(function (o) {
                        if (_this.options.dimensions.indexOf(use) > -1) {
                            return o.values[use];
                        }
                        return o.values[use] / ((_this.options.dimensions.indexOf(use) > -1) ? 1 : o.values[_this.options.ref]);
                    }))
                        .rangePoints([this_1.HEIGHT - (this_1.margins.top + this_1.margins.bottom + this_1.padding.top + this_1.padding.bottom), 0]);
                }
                else {
                    if (this_1.extents[d][0] === 0) {
                        this_1.extents[d][0] = 0.01;
                    }
                    this_1.scales[d] = d3.scale[this_1.options.scale_map[d] ? this_1.options.scale_map[d] : this_1.scale_type]().domain(this_1.extents[d]).range([this_1.HEIGHT - (this_1.margins.top + this_1.margins.bottom + this_1.padding.top + this_1.padding.bottom), 0]);
                }
                this_1.wscales[d] = d3.scale.linear().domain([0, this_1.extents[d][1]]).range(this_1.marker_width).nice();
            };
            var this_1 = this;
            for (var _i = 0, _a = this.options.columns; _i < _a.length; _i++) {
                var d = _a[_i];
                _loop_2(d);
            }
            this.yscales = this.scales;
            this.width_scales = this.wscales;
        };
        ParallelCoordinates.prototype.createAxes = function () {
            var _this = this;
            this.axes = {};
            this.options.columns.forEach(function (col) {
                _this.axes[col] = d3.svg.axis().scale(_this.yscales[col]).orient(col == _this.options.title_column ? "left" : "right").tickFormat(function (d) {
                    if (_this.options.formats[col]) {
                        return d3.format(_this.options.formats[col])(d);
                    }
                    if (col == _this.options.title_column) {
                        return "";
                    }
                    if (_this.scale_type == "log" && (!_this.options.scale_map[col] || _this.options.scale_map[col] == "log")) {
                        var values = [0.01, 0.1, 1, 10, 100, 1000, 10000, 100000, 1000000, 10000000];
                        if (values.indexOf(d) > -1) {
                            return d3.format(d >= 100 ? ",.0f" : ",.2f")(d);
                        }
                        return "";
                    }
                    if (_this.options.scale_map[col] == "ordinal") {
                        return d;
                    }
                    return d3.format(d >= 100 ? ",.0f" : ",.2f")(d);
                });
            });
            this.yAxes = this.axes;
        };
        ParallelCoordinates.prototype.addAxes = function () {
            var _this = this;
            var column = this.columns.selectAll("g.column")
                .data(this.options.columns)
                .enter()
                .append("g")
                .attr("class", "column")
                .attr("transform", function (d) {
                var x = _this.xscale(d);
                return "translate(" + x + "," + 0 + ")";
            });
            var title = column.append("text")
                .attr("class", "title")
                .attr("x", 0)
                .attr("y", 0);
            title
                .filter(function (d) {
                return d == _this.options.title_column;
            })
                .classed("first", true)
                .attr("transform", "translate(-10,0)");
            title
                .selectAll("tspan")
                .data(function (d) {
                var txt = _this.options.column_map[d];
                if (typeof txt == "string") {
                    return [txt];
                }
                return txt;
            })
                .enter()
                .append("tspan")
                .attr("x", 0)
                .attr("y", function (d, i) {
                return i * 15 + (-10 - _this.padding.top);
            })
                .text(function (d) {
                return d;
            });
            title
                .on("mouseover", function (d, i) {
                _this.tooltip
                    .style("left", function () {
                    var x = _this.xscale(d) + _this.margins.left + _this.padding.left;
                    if (d != _this.options.title_column) {
                        x += _this.marker_width[1] / 2;
                    }
                    if (i > _this.options.columns.length - 2) {
                        x -= (_this.marker_width[1] + 180 - 20);
                    }
                    return x + "px";
                })
                    .classed("visible", true)
                    .select("div");
            })
                .on("mouseout", function () {
                _this.tooltip
                    .classed("visible", false);
            });
            var axis = column
                .filter(function (col) {
                return _this.options.scale_map[col] == "ordinal" && col != _this.options.title_column;
            })
                .append("g")
                .attr("class", "axis")
                .attr("transform", function (d) {
                var x = 0, y = _this.HEIGHT - (_this.margins.bottom + _this.margins.top + _this.padding.bottom + 5);
                return "translate(" + x + "," + y + ")";
            });
            axis.append("line")
                .attr("x1", function (d) {
                return -_this.width_scales[d].range()[1] / 2;
            })
                .attr("y1", 0)
                .attr("x2", function (d) {
                return _this.width_scales[d].range()[1] / 2;
            })
                .attr("y2", 0);
            var ticks = axis
                .selectAll("g.tick")
                .data(function (d) {
                var ticks = [
                    0,
                    _this.width_scales[d].domain()[1]
                ].map(function (v, i) {
                    return {
                        value: i === 0 ? 0 : v,
                        x: (i === 0 ? 0 : _this.width_scales[d](v) / 2),
                        domain: _this.width_scales[d].domain(),
                        range: _this.width_scales[d].range()
                    };
                });
                return ticks.concat(ticks.map(function (t) {
                    return {
                        scale: d,
                        value: t['value'],
                        x: -t['x']
                    };
                }));
            })
                .enter()
                .append("g")
                .attr("class", "tick")
                .classed("start", function (d) {
                return d['x'] < 0;
            })
                .classed("end", function (d) {
                return d['x'] > 0;
            })
                .attr("transform", function (d) {
                return "translate(" + d['x'] + ",0)";
            });
            ticks.append("line")
                .attr("x1", 0)
                .attr("y1", -3)
                .attr("x2", 0)
                .attr("y2", 3);
            ticks.append("text")
                .attr("x", 0)
                .attr("y", 12)
                .text(function (d) {
                return d3.format("s")(d['value']);
            });
        };
        ParallelCoordinates.prototype.updateAxes = function () {
            var _this = this;
            this.columns
                .selectAll("g.axis")
                .selectAll("g.tick")
                .data(function (d) {
                var ticks = [
                    0,
                    _this.width_scales[d].domain()[1]
                ].map(function (v, i) {
                    return {
                        value: i === 0 ? 0 : v,
                        x: (i === 0 ? 0 : _this.width_scales[d](v) / 2),
                        domain: _this.width_scales[d].domain(),
                        range: _this.width_scales[d].range()
                    };
                });
                return ticks.concat(ticks.map(function (d) {
                    return {
                        value: d['value'],
                        x: -d['x']
                    };
                }));
            })
                .select("text")
                .text(function (d) {
                return d3.format("s")(d['value']);
            });
        };
        ParallelCoordinates.prototype.createKeys = function (keys) {
            keys.append("g")
                .attr("class", "connections");
            keys.append("g")
                .attr("class", "markers");
            var label = keys.append("g")
                .attr("class", "key-label");
            this.createKeyLabel(label);
        };
        ParallelCoordinates.prototype.updateMarkers = function (duration) {
            var _this = this;
            var marker = this.keys_group
                .selectAll(".key").select("g.markers")
                .selectAll("g.marker")
                .data(function (d) {
                return _this.options.columns.filter(function (col) {
                    return col != _this.options.title_column;
                }).map(function (col) {
                    return {
                        key: d.key,
                        column: col,
                        value: d.values[col],
                        ref: d.values[_this.options.ref]
                    };
                });
            }, function (d) {
                return d['key'] + "_" + d['column'];
            });
            marker.exit()
                .remove();
            var new_markers = marker.enter()
                .append("g")
                .attr("class", "marker")
                .classed("ordinal", function (d) {
                return _this.options.scale_map[d['column']] == "ordinal";
            })
                .attr("transform", function (d) {
                var x = _this.xscale(d['column']);
                var y = _this.yscales[d['column']].range()[0];
                return "translate(" + x + "," + y + ")";
            });
            new_markers
                .filter(function (d) {
                return _this.options.scale_map[d['column']] == "ordinal";
            })
                .append("rect")
                .attr("x", function (d) {
                return 0;
            })
                .attr("y", -4)
                .attr("width", 0)
                .attr("height", 8)
                .style({
                fill: "url(#diagonalHatch)"
            });
            new_markers
                .filter(function (d) {
                return _this.options.scale_map[d['column']] != "ordinal";
            })
                .append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", 2);
            new_markers
                .filter(function (d) {
                return _this.options.scale_map[d['column']] != "ordinal";
            })
                .append("circle")
                .attr("class", "hover")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", 5);
            marker
                .transition()
                .duration(duration || this.options.duration)
                .attr("transform", function (d) {
                var x = _this.xscale(d['column']);
                var y = _this.yscales[d['column']](d['value'] / d['ref']);
                if (d[d['column']] === 0) {
                    y = _this.yscales[d['column']].range()[0];
                }
                if (_this.options.dimensions.indexOf(d['column']) > -1) {
                    y = _this.yscales[d['column']](d['value']);
                }
                return "translate(" + x + "," + y + ")";
            });
            marker
                .select("rect")
                .transition()
                .duration(this.options.duration)
                .attr("x", function (d) {
                return -_this.width_scales[d['column']](d['value'] / ((_this.options.dimensions.indexOf(d['column']) > -1) ? 1 : d['ref'])) / 2;
            })
                .attr("width", function (d) {
                return _this.width_scales[d['column']](d['value'] / ((_this.options.dimensions.indexOf(d['column']) > -1) ? 1 : d['ref']));
            });
        };
        ParallelCoordinates.prototype.updateConnections = function (duration) {
            var _this = this;
            var connection = this.keys_group
                .selectAll(".key")
                .select("g.connections")
                .selectAll("g.connection")
                .data(function (d) {
                var values = _this.options.columns.map(function (col, i) {
                    var use = _this.options.use[col] || col;
                    var val = {
                        x: _this.xscale(col),
                        col: col
                    };
                    var val2 = {
                        x: _this.xscale(col),
                        col: col
                    };
                    var delta = 5;
                    if (_this.options.dimensions.indexOf(col) > -1) {
                        var y_1 = d.values[use];
                        if (typeof y_1 == "number") {
                            val.x -= (i == 0 ? 0 : (_this.width_scales[use](y_1)) / 2 + delta);
                            val2.x += ((i == _this.options.columns.length - 1) ? 0 : (_this.width_scales[use](y_1)) / 2 + delta);
                        }
                        else {
                            val.x -= delta;
                            val2.x += delta;
                        }
                        val['y'] = d['values'][use];
                        val2['y'] = d['values'][use];
                        return [val, val2];
                    }
                    var y = d.values[use] / ((_this.options.dimensions.indexOf(use) > -1) ? 1 : d.values[_this.options.ref]);
                    val['y'] = y;
                    val2['y'] = y;
                    val['x'] -= (i == 0 ? 0 : (_this.width_scales[use](y)) / 2 + delta);
                    val2['x'] += ((i == _this.options.columns.length - 1) ? 0 : (_this.width_scales[use](y)) / 2 + delta);
                    return [val, val2];
                });
                var flattened = values.reduce(function (a, b) {
                    return a.concat(b);
                });
                return [{
                        key: d.key,
                        path: flattened
                    }];
            }, function (d) {
                return d.key;
            });
            connection
                .exit()
                .remove();
            var new_connection = connection
                .enter()
                .append("g")
                .attr("class", "connection");
            new_connection
                .append("path")
                .attr("class", "hover");
            new_connection
                .append("path")
                .attr("class", "line");
            var paths = ["line", "hover"];
            for (var _i = 0, paths_1 = paths; _i < paths_1.length; _i++) {
                var p = paths_1[_i];
                connection
                    .select("path." + p)
                    .transition()
                    .duration(duration)
                    .attr("d", function (d) {
                    return _this.line(d.path);
                });
            }
        };
        ParallelCoordinates.prototype.update = function (__options) {
            this.updateScales();
            this.updateConnections(1);
            this.updateMarkers(1);
            this.updateLabels(1);
            this.updateKeyLabels(1);
            this.updateAxes();
        };
        ;
        ParallelCoordinates.prototype.updateLabels = function (duration) {
            var _this = this;
            var labels = this.labels_group
                .selectAll(".labels")
                .selectAll("g.label")
                .data(function (d) {
                return _this.options.columns
                    .map(function (col) {
                    var use = _this.options.use[col] || col;
                    return {
                        key: d.key,
                        column: col,
                        value: d.values[use],
                        ref: d.values[_this.options.ref],
                        text_width: 0,
                        marker_width: 0
                    };
                });
            });
            var new_label = labels.enter()
                .append("g")
                .attr("class", "label");
            new_label
                .filter(function (d) {
                return d['column'] != _this.options.title_column;
            })
                .append("path");
            new_label
                .filter(function (d) {
                return d['column'] != _this.options.title_column;
            })
                .append("text")
                .attr("x", 0)
                .attr("y", 4);
            new_label.append("rect")
                .attr("class", "ix")
                .attr("y", -8)
                .attr("height", 15);
            labels
                .selectAll("path.label")
                .attr("d", "M0,0L0,0");
            labels
                .selectAll("rect.ix")
                .attr("width", 0)
                .attr("x", 0);
            labels
                .select("text")
                .text(function (d) {
                if (_this.options.formats[d['column']]) {
                    return d3.format(_this.options.formats[d['column']])(d['value']);
                }
                if (_this.options.dimensions.indexOf(d['column']) > -1) {
                    return d3.format(d['value'] > 100 ? ",.0f" : ",.2f")(d['value']);
                }
                var y = d['valuefd'].ref;
                return d3.format(y > 100 ? ",.0f" : ",.2f")(y);
            })
                .each(function (d) {
                d['marker_width'] = _this.width_scales[d['column']](d['value'] / ((_this.options.dimensions.indexOf(d['column']) > -1) ? 1 : d['ref']));
            });
            labels
                .select("path")
                .attr("class", "label")
                .attr("d", function (d) {
                var dw = 10, w = d['text_width'] + dw;
                return "M" + (w / 2 + dw / 2) + ",0l-" + dw / 2 + ",-10l-" + w + ",0l0,20l" + w + ",0z";
            });
            labels
                .select("rect.ix")
                .attr("x", function (d) {
                if (d['column'] == _this.options.title_column) {
                    return -(_this.padding.left + _this.margins.left);
                }
                return d['text_width'] / 2;
            })
                .attr("width", function (d) {
                if (d['column'] == _this.options.title_column) {
                    return (_this.padding.left + _this.margins.left);
                }
                return d['marker_width'] + 20;
            });
            labels
                .attr("transform", function (d) {
                var x = _this.xscale(d['column']);
                var y = _this.yscales[d['column']](d['value']);
                if (d[d['column']] === 0) {
                    y = _this.yscales[d['column']].range()[0];
                }
                if (_this.options.dimensions.indexOf(d['column']) == -1) {
                    y = _this.yscales[d['column']](d['value'] / d['ref']);
                }
                return "translate(" + (x - d['marker_width'] / 2 - d['text_width'] / 2 - 10) + "," + y + ")";
            });
        };
        ParallelCoordinates.prototype.createKeyLabel = function (key_label) {
            var _this = this;
            key_label.attr("transform", function (d) {
                var x = _this.xscale(_this.options.title_column);
                var y = _this.yscales[_this.options.title_column].range()[0];
                return "translate(" + x + "," + y + ")";
            });
            var rect = key_label.append("rect")
                .attr("x", -(this.padding.left + this.margins.left))
                .attr("width", this.padding.left + this.margins.left)
                .attr("y", -9)
                .attr("height", 16);
            key_label.append("text")
                .attr("x", -10)
                .attr("y", 3)
                .text(function (d) {
                return d.values[_this.options.title_column];
            });
        };
        ParallelCoordinates.prototype.updateKeyLabels = function (duration) {
            var _this = this;
            this.keys_group.selectAll(".key")
                .select("g.key-label")
                .transition()
                .duration(duration || this.options.duration)
                .attr("transform", function (d) {
                var use = _this.options.use[_this.options.title_column] || _this.options.title_column;
                var x = _this.xscale(_this.options.title_column);
                var y = _this.yscales[_this.options.title_column](d.values[use]);
                y = _this.yscales[use](d.values[use]);
                return "translate(" + x + "," + y + ")";
            });
        };
        return ParallelCoordinates;
    }());
    ParallelCoordinates_1.ParallelCoordinates = ParallelCoordinates;
})(ParallelCoordinates || (ParallelCoordinates = {}));
//# sourceMappingURL=parallelcoordinates.js.map