module ParallelCoordinates {

    export interface Options {
        keys: Object,
        container: string,
        scale: string,

        columns: Array<string>,
        ref: string,
        title_column: string,
        scale_map: { [s: string]: string },
        use: { [s: string]: string },
        sorting: Object,
        formats: { [s: string]: string },
        dimensions: Array<string>,
        column_map: { [s: string]: any },
        duration: number,
        extension: string,
        callback : (string) => void
    }
    export interface Box {
        left: number,
        right: number,
        top: number,
        bottom: number
    }


    export class ParallelCoordinates {

        private wscales: {};
        private scales: {};
        private line: any;
        private labels_group: any;
        private keys_group: any;
        private svg: any;
        private tooltip: any;
        private xscale: any;
        private columns: any;
        private labels: any;
        private yAxes: any;
        private axes: {};
        private width_scales: { [s: string]: any; };
        private yscales: any;
        private marker_width: number[];
        private keys : Array<string> = [];
        private totals: {[p:string] : {[q:string] : string}} = {};

        private scale_type: string;
        private options: Options;
        private WIDTH: number = Math.round(window.innerWidth * (window.innerWidth <= 960 ? 1 : 0.8));
        private HEIGHT: number = Math.min(Math.max(Math.round(window.innerHeight - 150), 420), 600);
        private nested_data: { key: string; values: any }[];

        private margins: Box = {
            left: 20,
            right: 30,
            top: 30,
            bottom: 30
        };

        private padding: Box = {
            left: 70,
            right: 30,
            top: 20,
            bottom: 0
        };

        private extents = {};

        constructor(data : {[p: string] : string}[], options: Options) {

            this.scale_type = options.scale || "linear";
            this.options = options;

            for (let d of data) {
                this.keys.push(d["key"]);
            }

            for (let d of data) {
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
                .style("width", `${this.WIDTH}px`)
                .append("svg")
                .attr("width", this.WIDTH)
                .attr("height", this.HEIGHT);

            let defs = this.svg.append("defs")
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

            const left = this.margins.left + this.padding.left;
            const top = this.margins.top + this.padding.top;

            this.keys_group = this.svg.append("g")
                .attr("id", "keys")
                .attr("transform", `translate(${left},${top})`);

            this.labels_group = this.svg.append("g")
                .attr("id", "labels")
                .attr("transform", `translate(${left},${top})`);

            this.columns = this.svg.append("g")
                .attr("id", "columns")
                .attr("transform", `translate(${left},${top})`);

            this.addAxes();

            this.labels = this.labels_group.selectAll("g.labels")
                .data(this.nested_data, (d) => {
                    return d.key;
                })
                .enter()
                .append("g")
                .attr("class", "labels")
                .attr("rel", (d) => {
                    return d.key;
                })
                .on("click", (d) => {
                    let target: Event = <Event>(d3.event);
                    let $this = d3.select(target.currentTarget);
                    $this.classed("highlight", !($this.classed("highlight")));
                    this.keys_group
                        .selectAll(`g.key[rel='${d.key}']`)
                        .classed("highlight", $this.classed("highlight"));

                    // execute the callback on label click
                    if (this.options.callback != null) {
                        this.options.callback(d.key);
                    }

                    console.log(d.key);
                })
                .on("mouseover", (d) => {
                    let target: Event = <Event>(d3.event);
                    let $this = d3.select(target.currentTarget);

                    $this.classed("hover", true);
                    this.keys_group
                        .selectAll(`g.key[rel='${d.key}']`)
                        .classed("hover", true)
                })
                .on("mouseout", (d) => {
                    this.svg.selectAll("g.hover")
                        .classed("hover", false)
                });

            let key = this.keys_group.selectAll("g.key")
                .data(this.nested_data, (d) => {
                    return d.key;
                })
                .enter()
                .append("g")
                .attr("class", "key")
                .attr("rel", (d) => {
                    return d.key;
                });

            this.line = d3.svg.line()
                .x((d, i) => {
                    return d['x'];
                })
                .y((d, i) => {
                    if (d['y'] === 0) {
                        return this.yscales[options.use[d['col']] || d['col']].range()[0]
                    }
                    return this.yscales[options.use[d['col']] || d['col']](d['y'])
                });


            this.createKeys(key);
            this.updateConnections(-1);
            this.updateMarkers(-1);
            this.updateLabels(-1);
            this.updateKeyLabels(-1);

        }


        private nestData(data : {[p: string] : string}[]): { key: string; values: any }[] {
            return d3.nest()
                .key((d) => {
                    return d['key'];
                })
                .rollup((leaves) => {

                    let r = {};

                    console.log(this.options.columns);

                    for (let col of this.options.columns) {
                        r[col] = d3.sum(leaves, (o) => {
                            return o[col]
                        });

                        r['key'] = leaves[0]["key"];
                    }
                    return r;
                })
                .entries(data)
                .filter((d) => {
                    return d.key != "null";
                })
                .sort((a, b) => {
                    return d3.descending(a.values[this.options.use["name"]], b.values[this.options.use["name"]]);
                })
                .slice(0, 28)
        }

        private updateScales() {

            this.extents = {};
            this.options.columns.forEach((d, i) => {
                this.extents[d] = d3.extent(this.nested_data, (o: any) => {
                    if (this.options.dimensions.indexOf(d) > -1) {
                        return o.values[d];
                    }
                    return o.values[d] / o.values[this.options.ref]
                })
            });

            this.scales = {};
            this.wscales = {};

            for (let d of this.options.columns) {

                let use = this.options.use[d] || d;

                if (this.options.scale_map[d] == "ordinal") {
                    let inc = 0.000001;
                    this.scales[d] = d3.scale.ordinal()
                        .domain(this.nested_data.filter(function () {
                            return true;
                        }).sort((a, b) => {

                            let sorting = this.options.sorting[use] || d3.ascending;

                            if (a.values[use] == b.values[use]) {
                                if (d3.ascending(a.key, b.key) > 1) {
                                    a.values[use] += inc;
                                } else {
                                    b.values[use] += inc;
                                }
                                inc += inc;
                            }

                            let __a = (a.values[use]),
                                __b = (b.values[use]);

                            if (this.options.dimensions.indexOf(d) == -1) {
                                __a = (a.values[use] / ((this.options.dimensions.indexOf(use) > -1) ? 1 : a.values[this.options.ref]));
                                __b = (b.values[use] / ((this.options.dimensions.indexOf(use) > -1) ? 1 : b.values[this.options.ref]))
                            }

                            return sorting(__a, __b);

                        }).map(o => {
                            if (this.options.dimensions.indexOf(use) > -1) {
                                return o.values[use];
                            }
                            return o.values[use] / ((this.options.dimensions.indexOf(use) > -1) ? 1 : o.values[this.options.ref])
                        }))
                        .rangePoints([this.HEIGHT - (this.margins.top + this.margins.bottom + this.padding.top + this.padding.bottom), 0]);

                } else {
                    if (this.extents[d][0] === 0) {
                        this.extents[d][0] = 0.01;
                    }

                    this.scales[d] = d3.scale[this.options.scale_map[d] ? this.options.scale_map[d] : this.scale_type]().domain(this.extents[d]).range([this.HEIGHT - (this.margins.top + this.margins.bottom + this.padding.top + this.padding.bottom), 0]);
                }

                this.wscales[d] = d3.scale.linear().domain([0, this.extents[d][1]]).range(this.marker_width).nice()

            }
            this.yscales = this.scales;
            this.width_scales = this.wscales;


        }


        private createAxes() {
            this.axes = {};
            this.options.columns.forEach(col => {
                this.axes[col] = d3.svg.axis().scale(this.yscales[col]).orient(col == this.options.title_column ? "left" : "right").tickFormat(d => {

                    if (this.options.formats[col]) {
                        return d3.format(this.options.formats[col])(d)
                    }

                    if (col == this.options.title_column) {
                        return "";
                    }

                    if (this.scale_type == "log" && (!this.options.scale_map[col] || this.options.scale_map[col] == "log")) {
                        let values = [0.01, 0.1, 1, 10, 100, 1000, 10000, 100000, 1000000, 10000000];

                        if (values.indexOf(d) > -1) {
                            return d3.format(d >= 100 ? ",.0f" : ",.2f")(d);
                        }
                        return "";
                    }
                    if (this.options.scale_map[col] == "ordinal") {
                        return d;
                    }
                    return d3.format(d >= 100 ? ",.0f" : ",.2f")(d);
                })
            });
            this.yAxes = this.axes;
        }

        private addAxes() {

            let column = this.columns.selectAll("g.column")
                .data(this.options.columns)
                .enter()
                .append("g")
                .attr("class", "column")
                .attr("transform", d => {
                    let x = this.xscale(d);
                    return "translate(" + x + "," + 0 + ")";
                });

            let title = column.append("text")
                .attr("class", "title")
                .attr("x", 0)
                .attr("y", 0);

            title
                .filter((d) => {
                    return d == this.options.title_column
                })
                .classed("first", true)
                .attr("transform", "translate(-10,0)");

            title
                .selectAll("tspan")
                .data((d) => {
                    let txt = this.options.column_map[d];
                    if (typeof txt == "string") {
                        return [txt];
                    }
                    return txt;
                })
                .enter()
                .append("tspan")
                .attr("x", 0)
                .attr("y", (d, i) => {
                    return i * 15 + (-10 - this.padding.top);
                })
                .text(function (d: string) {
                    return d;
                });

            title
                .on("mouseover", (d: string, i) => {
                    this.tooltip
                        .style("left", () => {
                            let x = this.xscale(d) + this.margins.left + this.padding.left;

                            if (d != this.options.title_column) {
                                x += this.marker_width[1] / 2;
                            }
                            if (i > this.options.columns.length - 2) {
                                x -= (this.marker_width[1] + 180 - 20);
                            }
                            return `${x}px`
                        })
                        .classed("visible", true)
                        .select("div")
                    // .html(this.options.help[d])
                })
                .on("mouseout", () => {
                    this.tooltip
                        .classed("visible", false)
                });

            let axis = column
                .filter((col: string) => {
                    return this.options.scale_map[col] == "ordinal" && col != this.options.title_column;
                })
                .append("g")
                .attr("class", "axis")
                .attr("transform", d => {
                    let x = 0,
                        y = this.HEIGHT - (this.margins.bottom + this.margins.top + this.padding.bottom + 5);
                    return `translate(${x},${y})`;
                });

            axis.append("line")
                .attr("x1", (d: string) => {
                    return -this.width_scales[d].range()[1] / 2;
                })
                .attr("y1", 0)
                .attr("x2", (d: string) => {
                    return this.width_scales[d].range()[1] / 2;
                })
                .attr("y2", 0);

            let ticks = axis
                .selectAll("g.tick")
                .data((d: string) => {

                    let ticks: Array<any> = [
                        0,
                        this.width_scales[d].domain()[1]
                    ].map((v, i) => {
                        return {
                            value: i === 0 ? 0 : v,
                            x: (i === 0 ? 0 : this.width_scales[d](v) / 2),
                            domain: this.width_scales[d].domain(),
                            range: this.width_scales[d].range()
                        }
                    });

                    return ticks.concat(ticks.map((t) => {
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
                .classed("start", (d) => {
                    return d['x'] < 0;
                })
                .classed("end", (d) => {
                    return d['x'] > 0;
                })
                .attr("transform", (d) => {
                    return `translate(${d['x']},0)`;
                });

            ticks.append("line")
                .attr("x1", 0)
                .attr("y1", -3)
                .attr("x2", 0)
                .attr("y2", 3);

            ticks.append("text")
                .attr("x", 0)
                .attr("y", 12)
                .text((d) => {
                    return d3.format("s")(d['value']);
                })
        }

        private updateAxes() {

            this.columns
                .selectAll("g.axis")
                .selectAll("g.tick")
                .data((d) => {

                    let ticks: Array<Object> = [
                        0,
                        this.width_scales[d].domain()[1]
                    ].map((v, i) => {
                        return {
                            value: i === 0 ? 0 : v,
                            x: (i === 0 ? 0 : this.width_scales[d](v) / 2),
                            domain: this.width_scales[d].domain(),
                            range: this.width_scales[d].range()
                        }
                    });

                    return ticks.concat(ticks.map((d) => {
                        return {
                            value: d['value'],
                            x: -d['x']
                        };
                    }));
                })
                .select("text")
                .text((d) => {
                    return d3.format("s")(d['value']);
                })
        }


        private createKeys(keys) {
            keys.append("g")
                .attr("class", "connections");

            keys.append("g")
                .attr("class", "markers");

            let label = keys.append("g")
                .attr("class", "key-label");

            this.createKeyLabel(label);

        }


        private updateMarkers(duration) {

            let marker = this.keys_group
                .selectAll(".key").select("g.markers")
                .selectAll("g.marker")
                .data((d) => {
                    return this.options.columns.filter((col) => {
                        return col != this.options.title_column
                    }).map((col) => {
                        return {
                            key: d.key,
                            column: col,
                            value: d.values[col],
                            ref: d.values[this.options.ref]
                        }
                    })
                }, function (d) {
                    return `${d['key']}_${d['column']}`;
                });

            marker.exit()
                .remove();

            let new_markers = marker.enter()
                .append("g")
                .attr("class", "marker")
                .classed("ordinal", (d) => {
                    return this.options.scale_map[d['column']] == "ordinal"
                })
                .attr("transform", (d) => {

                    let x = this.xscale(d['column']);
                    let y = this.yscales[d['column']].range()[0];

                    return `translate(${x},${y})`;
                });


            new_markers
                .filter((d) => {
                    return this.options.scale_map[d['column']] == "ordinal"
                })
                .append("rect")
                .attr("x", (d) => {
                    return 0;
                })
                .attr("y", -4)
                .attr("width", 0)
                .attr("height", 8)
                .style({
                    fill: "url(#diagonalHatch)"
                });

            new_markers
                .filter((d) => {
                    return this.options.scale_map[d['column']] != "ordinal"
                })
                .append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", 2);

            new_markers
                .filter((d) => {
                    return this.options.scale_map[d['column']] != "ordinal"
                })
                .append("circle")
                .attr("class", "hover")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", 5);


            marker
                .transition()
                .duration(duration || this.options.duration)
                .attr("transform", (d) => {

                    let x = this.xscale(d['column']);
                    let y = this.yscales[d['column']](d['value'] / d['ref']);
                    if (d[d['column']] === 0) {
                        y = this.yscales[d['column']].range()[0]
                    }
                    if (this.options.dimensions.indexOf(d['column']) > -1) {
                        y = this.yscales[d['column']](d['value'])
                    }

                    return `translate(${x},${y})`;
                });

            marker
                .select("rect")
                .transition()
                .duration(this.options.duration)
                .attr("x", (d) => {
                    return -this.width_scales[d['column']](d['value'] / ((this.options.dimensions.indexOf(d['column']) > -1) ? 1 : d['ref'])) / 2;
                })
                .attr("width", (d) => {
                    return this.width_scales[d['column']](d['value'] / ((this.options.dimensions.indexOf(d['column']) > -1) ? 1 : d['ref']));
                })
        }

        private updateConnections(duration: number) {
            let connection = this.keys_group
                .selectAll(".key")
                .select("g.connections")
                .selectAll("g.connection")
                .data((d) => {

                    let values = this.options.columns.map((col, i) => {
                        let use = this.options.use[col] || col;

                        let val = {
                            x: this.xscale(col),
                            col: col
                        };
                        let val2 = {
                            x: this.xscale(col),
                            col: col
                        };

                        let delta = 5;

                        if (this.options.dimensions.indexOf(col) > -1) {

                            let y = d.values[use];


                            if (typeof y == "number") {
                                val.x -= (i == 0 ? 0 : (this.width_scales[use](y)) / 2 + delta);
                                val2.x += ((i == this.options.columns.length - 1) ? 0 : (this.width_scales[use](y)) / 2 + delta)
                            } else {
                                val.x -= delta;
                                val2.x += delta;
                            }
                            val['y'] = d['values'][use];
                            val2['y'] = d['values'][use];

                            return [val, val2];
                        }

                        let y: any = d.values[use] / ((this.options.dimensions.indexOf(use) > -1) ? 1 : d.values[this.options.ref]);
                        val['y'] = y;
                        val2['y'] = y;

                        val['x'] -= (i == 0 ? 0 : (this.width_scales[use](y)) / 2 + delta);
                        val2['x'] += ((i == this.options.columns.length - 1) ? 0 : (this.width_scales[use](y)) / 2 + delta);


                        return [val, val2]
                    });

                    let flattened = values.reduce(function (a, b) {
                        return a.concat(b);
                    });
                    return [{
                        key: d.key,
                        path: flattened
                    }]
                }, (d) => {
                    return d.key;
                });

            connection
                .exit()
                .remove();

            let new_connection = connection
                .enter()
                .append("g")
                .attr("class", "connection");

            new_connection
                .append("path")
                .attr("class", "hover");

            new_connection
                .append("path")
                .attr("class", "line");

            let paths = ["line", "hover"];
            for (let p of paths) {
                connection
                    .select("path." + p)
                    .transition()
                    .duration(duration)
                    .attr("d", (d) => {
                        return this.line(d.path)
                    })
            }


        }

        private update(__options) {

            this.updateScales();

            this.updateConnections(1);
            this.updateMarkers(1);
            this.updateLabels(1);
            this.updateKeyLabels(1);
            this.updateAxes();
        };

        private updateLabels(duration: number) {
            let labels = this.labels_group
                .selectAll(".labels")
                .selectAll("g.label")
                .data((d) => {
                    return this.options.columns
                        .map((col) => {
                            let use = this.options.use[col] || col;

                            return {
                                key: d.key,
                                column: col,
                                value: d.values[use],
                                ref: d.values[this.options.ref],
                                text_width: 0,
                                marker_width: 0
                            }
                        })
                });
            let new_label = labels.enter()
                .append("g")
                .attr("class", "label");

            new_label
                .filter((d) => {
                    return d['column'] != this.options.title_column;
                })
                .append("path");

            new_label
                .filter((d) => {
                    return d['column'] != this.options.title_column;
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
                .text((d) => {

                    if (this.options.formats[d['column']]) {
                        return d3.format(this.options.formats[d['column']])(d['value'])
                    }

                    if (this.options.dimensions.indexOf(d['column']) > -1) {
                        return d3.format(d['value'] > 100 ? ",.0f" : ",.2f")(d['value'])
                    }
                    let y = d['valuefd'].ref;

                    return d3.format(y > 100 ? ",.0f" : ",.2f")(y)
                })
                .each((d) => {
                    d['marker_width'] = this.width_scales[d['column']](d['value'] / ((this.options.dimensions.indexOf(d['column']) > -1) ? 1 : d['ref']));
                    // d['text_width'] = this.getBBox().width;
                });


            labels
                .select("path")
                .attr("class", "label")
                .attr("d", (d) => {
                    let dw = 10,
                        w = d['text_width'] + dw;
                    return `M${(w / 2 + dw / 2)},0l-${dw / 2},-10l-${w},0l0,20l${w},0z`;
                });
            labels
                .select("rect.ix")
                .attr("x", (d) => {
                    if (d['column'] == this.options.title_column) {
                        return -(this.padding.left + this.margins.left);
                    }
                    return d['text_width'] / 2;
                })
                .attr("width", (d) => {
                    if (d['column'] == this.options.title_column) {
                        return (this.padding.left + this.margins.left);
                    }
                    return d['marker_width'] + 20;
                });

            labels
                .attr("transform", (d) => {

                    let x = this.xscale(d['column']);
                    let y = this.yscales[d['column']](d['value']);

                    if (d[d['column']] === 0) {
                        y = this.yscales[d['column']].range()[0]
                    }
                    if (this.options.dimensions.indexOf(d['column']) == -1) {
                        y = this.yscales[d['column']](d['value'] / d['ref'])
                    }

                    return `translate(${(x - d['marker_width'] / 2 - d['text_width'] / 2 - 10)},${y})`;
                });

        }

        private createKeyLabel(key_label) {

            key_label.attr("transform", (d) => {

                let x = this.xscale(this.options.title_column);
                let y = this.yscales[this.options.title_column].range()[0];

                return `translate(${x},${y})`;

            });

            let rect = key_label.append("rect")
                .attr("x", -(this.padding.left + this.margins.left))
                .attr("width", this.padding.left + this.margins.left)
                .attr("y", -9)
                .attr("height", 16);

            key_label.append("text")
                .attr("x", -10)
                .attr("y", 3)
                .text((d) => {
                    return d.values[this.options.title_column];
                })
        }

        private updateKeyLabels(duration: number) {
            this.keys_group.selectAll(".key")
                .select("g.key-label")
                .transition()
                .duration(duration || this.options.duration)
                .attr("transform", (d) => {

                    let use = this.options.use[this.options.title_column] || this.options.title_column;
                    let x = this.xscale(this.options.title_column);
                    let y = this.yscales[this.options.title_column](d.values[use]);
                    y = this.yscales[use](d.values[use]);
                    return `translate(${x},${y})`;

                });
        }

    }

}