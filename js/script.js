import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

function updateGlucoseMealTimeline() {
  d3.select("#food-visualization").select("svg").remove();

  Promise.all([
    d3.csv("data/dexcom_all_standardized_filtered_final.csv", d => ({
      TimeInMinutes: +d.TimeInMinutes,
      Glucose: +d.Glucose,
      participant_id: d.participant_id
    })),
    d3.csv("data/combined_food_glucose_standardized_filtered.csv", d => ({
      TimeInMinutes: +d.TimeInMinutes,
      logged_food: d.logged_food,
      calorie: +d.calorie,
      total_carb: +d.total_carb,
      participant_id: d.participant_id
    }))
  ]).then(([glucoseData, mealData]) => {
    const participantsToShow = ["001", "006", "011"];
    glucoseData = glucoseData.filter(d => participantsToShow.includes(d.participant_id));
    mealData = mealData.filter(d => participantsToShow.includes(d.participant_id));

    const xDomain = [0, 14400];

    const dataByParticipant = d3.group(glucoseData, d => d.participant_id);

    const yMin = d3.min(glucoseData, d => d.Glucose);
    const yMax = d3.max(glucoseData, d => d.Glucose);

    const margin = { top: 20, right: 40, bottom: 50, left: 60 };
    const width = 960 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = d3.select("#food-visualization")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .call(d3.zoom().scaleExtent([1, 10]).on("zoom", ({ transform }) => {
          svg.attr("transform", transform);
      }))
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain(xDomain)
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([yMin - 5, yMax + 5])
      .range([height, 0]);

    svg.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${height})`)
      .call(d3.axisBottom(x).ticks(10).tickFormat(d => d + " min"));

    svg.append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(y));

    svg.append("text")
      .attr("class", "axis-label")
      .attr("x", width / 2)
      .attr("y", height + 40)
      .attr("text-anchor", "middle")
      .text("Time (minutes over 10 days)");

    svg.append("text")
      .attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -40)
      .attr("text-anchor", "middle")
      .text("Glucose Level (mg/dL)");

    const lineGenerator = d3.line()
      .x(d => x(d.TimeInMinutes))
      .y(d => y(d.Glucose));

    dataByParticipant.forEach((values, participant) => {
      svg.append("path")
         .datum(values)
         .attr("fill", "none")
         .attr("stroke", d3.schemeCategory10[parseInt(participant) % 10] || "steelblue")
         .attr("stroke-width", 1.5)
         .attr("d", lineGenerator);
    });

    svg.selectAll("circle.meal")
      .data(mealData)
      .enter()
      .append("circle")
      .attr("class", "meal-dot")
      .attr("cx", d => x(d.TimeInMinutes))
      .attr("cy", d => {
        const partData = dataByParticipant.get(d.participant_id);
        if (partData && partData.length) {
          const avgGlucose = d3.mean(partData, p => p.Glucose);
          return y(avgGlucose);
        } else {
          return y((yMin + yMax) / 2);
        }
      })
      .attr("r", 5)
      .attr("fill", "black")
      .attr("stroke", "white")
      .attr("stroke-width", 1)
      .on("mouseover", (event, d) => {
        const tooltip = d3.select("body").append("div")
          .attr("class", "tooltip")
          .style("opacity", 0);
        tooltip.transition().duration(200).style("opacity", 0.9);
        tooltip.html(`
          <strong>Meal:</strong> ${d.logged_food}<br/>
          <strong>Time:</strong> ${d.TimeInMinutes.toFixed(0)} min<br/>
          <strong>Calories:</strong> ${d.calorie}<br/>
          <strong>Carbs:</strong> ${d.total_carb}
        `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", () => {
        d3.selectAll(".tooltip").remove();
      });
  }).catch(err => console.error("Error loading data: ", err));
}

updateGlucoseMealTimeline();