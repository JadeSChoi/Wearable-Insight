import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

function updateMealResponseTimeline() {
  d3.select("#food-visualization").select("svg").remove();

  d3.csv("data/combined_food_glucose.csv", d => ({
    time_begin: new Date(d.time_begin),
    logged_food: d.logged_food,
    calorie: +d.calorie,
    total_carb: +d.total_carb,
    glucose_mean: +d.glucose_mean,
    glucose_min: +d.glucose_min,
    glucose_max: +d.glucose_max,
    glucose_std: +d.glucose_std,
    participant_id: d.participant_id
  })).then(data => {
    data.sort((a, b) => a.time_begin - b.time_begin);

    const margin = { top: 20, right: 40, bottom: 50, left: 60 },
          width = 960 - margin.left - margin.right,
          height = 500 - margin.top - margin.bottom;

    const svg = d3.select("#food-visualization")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .call(d3.zoom().scaleExtent([1, 10]).on("zoom", (event) => {
         svg.attr("transform", event.transform);
      }))
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleTime()
      .domain(d3.extent(data, d => d.time_begin))
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([
        d3.min(data, d => d.glucose_min) - 5,
        d3.max(data, d => d.glucose_max) + 5
      ])
      .range([height, 0]);

    svg.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${height})`)
      .call(d3.axisBottom(x).ticks(10));

    svg.append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(y));

    svg.append("text")
      .attr("class", "axis-label")
      .attr("x", width / 2)
      .attr("y", height + 40)
      .attr("text-anchor", "middle")
      .text("Meal Time");

    svg.append("text")
      .attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -40)
      .attr("text-anchor", "middle")
      .text("Average Glucose Level (mg/dL)");

    svg.selectAll("circle.meal")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "meal-marker")
      .attr("cx", d => x(d.time_begin))
      .attr("cy", d => y(d.glucose_mean))
      .attr("r", 6)
      .attr("fill", "tomato")
      .attr("stroke", "white")
      .attr("stroke-width", 1)
      .on("mouseover", (event, d) => {
        const tooltip = d3.select("body").append("div")
          .attr("class", "tooltip")
          .style("opacity", 0);
        tooltip.transition().duration(200).style("opacity", 0.9);
        tooltip.html(`
          <strong>Meal:</strong> ${d.logged_food}<br/>
          <strong>Time:</strong> ${d.time_begin.toLocaleTimeString()}<br/>
          <strong>Calories:</strong> ${d.calorie}<br/>
          <strong>Carbs:</strong> ${d.total_carb}<br/>
          <strong>Glucose Mean:</strong> ${d.glucose_mean.toFixed(1)}<br/>
          <strong>Range:</strong> ${d.glucose_min} - ${d.glucose_max}
        `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", () => {
        d3.selectAll(".tooltip").remove();
      });
  }).catch(err => console.error("Error loading data:", err));
}

updateMealResponseTimeline();
