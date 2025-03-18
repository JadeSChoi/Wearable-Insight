// DO NOT DELETE ANYTHING EVEN IF IT SEEMS REPETITIVE. REMOVING IT MAY UNEXPECTEDLY CAUSE ISSUES.
const labelMapping = {
    "EDA": "Electrodermal Activity",
    "ACC": "Accelerometer",
    "HR": "Heart Rate ",
    "IBI": "Interbeat Interval",
    "TEMP": "Skin Temperature",
    "BVP": "Blood Volume Pulse ",
    "Dexcom": "Glucose"
  };

  const colorDiabetes = "lightblue";   
  const colorNormal = "pink";     

  function drawChart(data, svgSelector) {
    const margin = { top: 10, right: 20, bottom: 20, left: 120 },
          width = 450,
          height = 300; 

    const svg = d3.select(svgSelector)
      .attr("width", width)
      .attr("height", height);

    if (!data || data.length === 0) {
      svg.append("text")
         .attr("x", width/2)
         .attr("y", height/2)
         .attr("text-anchor", "middle")
         .text("No data in this category");
      return;
    }

    data.forEach(d => {
      d.Diabetes = +d.Diabetes;
      d["Non-Diabetes"] = +d["Non-Diabetes"];
    });

    const xScale = d3.scaleLinear()
      .domain([-0.15, 0.15  ])
      .range([margin.left, width - margin.right]);

    const yScale = d3.scaleBand()
      .domain(data.map(d => d.Measurement))
      .range([margin.top, height - margin.bottom])
      .padding(0.4);

    const xAxis = d3.axisBottom(xScale).ticks(5);
    svg.append("g")
      .attr("class", "axis x-axis")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(xAxis);

    const yAxis = d3.axisLeft(yScale)
      .tickFormat(d => labelMapping[d] || d);

    svg.append("g")
      .attr("class", "axis y-axis")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(yAxis);

    // Shaded gray area for -0.1 to 0.1
    svg.append("rect")
      .attr("x", xScale(-0.1))
      .attr("y", margin.top)
      .attr("width", xScale(0.1) - xScale(-0.1))
      .attr("height", height - margin.top - margin.bottom)
      .attr("fill", "#f0f0f0");

    // Vertical line at x=0
    svg.append("line")
      .attr("x1", xScale(0))
      .attr("y1", margin.top)
      .attr("x2", xScale(0))
      .attr("y2", height - margin.bottom)
      .attr("stroke", "#999")
      .attr("stroke-dasharray", "2,2");

    // Bars
    svg.selectAll(".row-group")
      .data(data)
      .enter()
      .append("g")
        .attr("class", "row-group")
      .each(function(d, i) {
        const g = d3.select(this);
        const band = yScale.bandwidth();
        const barHeight = band * 0.2;

        // Diabetes bar
        g.append("rect")
          .attr("y", yScale(d.Measurement) + band * 0.1)
          .attr("height", barHeight)
          .attr("x", xScale(0))
          .attr("width", 0)
          .attr("fill", "pink")
          .transition()
            .duration(1000)
            .delay(i * 200)
            .attr("x", xScale(Math.min(d.Diabetes, 0)))
            .attr("width", Math.abs(xScale(d.Diabetes) - xScale(0)));

        // Non-Diabetes bar
        g.append("rect")
          .attr("y", yScale(d.Measurement) + band * 0.5)
          .attr("height", barHeight)
          .attr("x", xScale(0))
          .attr("width", 0)
          .attr("fill", "lightblue")
          .transition()
            .duration(1000)
            .delay(i * 200)
            .attr("x", xScale(Math.min(d["Non-Diabetes"], 0)))
            .attr("width", Math.abs(xScale(d["Non-Diabetes"]) - xScale(0)));
      });
  }

  //////////////////////////////////////////////////////////
  // Main code: load CSV, split by category, call drawChart
  //////////////////////////////////////////////////////////
  window.addEventListener("scroll", function() {
    let scrollPos = window.scrollY;
    document.getElementById("hero-title").style.transform = `translateX(${-scrollPos * 1}px)`;
    document.getElementById("hero-subtitle").style.opacity = Math.max(1 - scrollPos / 300, 0);
  });

  let bothGroups, oneGroup, neither;
  d3.csv("correlations1.csv").then(fullData => {
    fullData.forEach(d => {
      d.Diabetes = +d.Diabetes;
      d["Non-Diabetes"] = +d["Non-Diabetes"];
    });

    bothGroups = fullData.filter(d => d.ImpactCategory === "Both Groups");
    oneGroup = fullData.filter(d => d.ImpactCategory === "One Group");
    neither   = fullData.filter(d => d.ImpactCategory === "Neither");

    drawChart(bothGroups, "#chart-both");
    drawChart(oneGroup, "#chart-one");
    drawChart(neither, "#chart-neither");
  });

  function restartCharts() {
    d3.select("#chart-both").html("");
    d3.select("#chart-one").html("");
    d3.select("#chart-neither").html("");

    drawChart(bothGroups, "#chart-both");
    drawChart(oneGroup, "#chart-one");
    drawChart(neither, "#chart-neither");
  }

  function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return rect.top < window.innerHeight * 0.75; 
  }

  document.addEventListener("scroll", restartCharts);
  document.addEventListener("DOMContentLoaded", restartCharts);
  document.getElementById("replay-animation").addEventListener("click", restartCharts);

  let correlationData = {};
  d3.csv("final_correlations.csv").then(data => {
      data.forEach(d => {
          let hba1c = parseFloat(d.HbA1c);
          correlationData[hba1c] = {
              "ACC": +d["ACC Corr"],
              "BVP": +d["BVP Corr"],
              "EDA": +d["EDA Corr"],
              "HR": +d["HR Corr"],
              "IBI": +d["IBI Corr"],
              "TEMP": +d["TEMP Corr"]
          };
      });
      updateCharts(5.3);
  });

  document.getElementById("hba1c-slider").addEventListener("input", function() {
      let selectedValue = parseFloat(this.value);
      document.getElementById("hba1c-value").innerText = selectedValue;
      updateCharts(selectedValue);
  });

  function updateCharts(hba1cLevel) {
      let data = correlationData[hba1cLevel] || {
          "ACC": 0, "BVP": 0, "EDA": 0, "HR": 0, "IBI": 0, "TEMP": 0
      };

      const width = 100, height = 300, margin = { top: 10, right: 10, bottom: 30, left: 10 };
      const yScale = d3.scaleLinear()
          .domain([-0.3, 0.3])
          .range([height - margin.bottom, margin.top]);

      const xScale = d3.scaleBand()
          .domain(["bar"])
          .range([margin.left, width - margin.right])
          .padding(0.1);

      ["ACC", "BVP", "EDA", "HR", "IBI", "TEMP"].forEach(feature => {
          let svg = d3.select("#chart-" + feature);
          svg.selectAll("*").remove(); 
          svg.attr("width", width).attr("height", height);

          // Gray area for -0.1 to 0.1
          svg.append("rect")
              .attr("x", margin.left)
              .attr("width", width - margin.right - margin.left)
              .attr("y", yScale(0.1))
              .attr("height", yScale(-0.1) - yScale(0.1))
              .attr("fill", "#f0f0f0");

          // Horizontal line at y=0
          svg.append("line")
              .attr("x1", margin.left)
              .attr("x2", width - margin.right)
              .attr("y1", yScale(0))
              .attr("y2", yScale(0))
              .attr("stroke", "#999")
              .attr("stroke-dasharray", "2,2");

          // Bar
          svg.append("rect")
              .attr("x", xScale("bar"))
              .attr("width", xScale.bandwidth())
              .attr("y", yScale(0))
              .attr("height", 0)
              .attr("fill", data[feature] > 0 ? "pink" : "lightblue")
              .on("mouseover", function (event, d) {
                  tooltip.style("visibility", "visible")
                         .html(`${featureNames[feature]}: ${data[feature].toFixed(3)}`);
              })
              .on("mousemove", function (event) {
                  tooltip.style("top", (event.pageY - 10) + "px")
                         .style("left", (event.pageX + 10) + "px");
              })
              .on("mouseout", function () {
                  tooltip.style("visibility", "hidden");
              })
              .transition()
              .duration(1000)
              .attr("y", yScale(Math.max(data[feature], 0)))
              .attr("height", Math.abs(yScale(data[feature]) - yScale(0)));

          // Y-axis
          svg.append("g")
              .attr("transform", `translate(${width / 2}, 0)`)
              .call(d3.axisLeft(yScale).ticks(5));
      });
  }