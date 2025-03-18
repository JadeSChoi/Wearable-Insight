import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

let allGlucoseData, allMealData;

const fullTimeDomain = [0, 14400];

const participantColors = {
  "001": d3.schemeCategory10[0],
  "006": d3.schemeCategory10[1],
  "011": d3.schemeCategory10[2]
};

Promise.all([
  d3.csv("data/df_final.csv", d => ({
    TimeInMinutes: +d.TimeInMinutes,
    Glucose: +d.Glucose,
    participant_id: d.participant_id
  })),
  d3.csv("data/food_final.csv", d => ({
    TimeInMinutes: +d.TimeInMinutes,
    logged_food: d.logged_food,
    calorie: +d.calorie,
    total_carb: +d.total_carb,
    sugar: +d.sugar,
    participant_id: d.participant_id
  }))
]).then(([glucoseData, mealData]) => {
  const participantsToShow = ["001", "006", "011"];
  allGlucoseData = glucoseData.filter(d => participantsToShow.includes(d.participant_id));
  allMealData = mealData.filter(d => participantsToShow.includes(d.participant_id));

  updateVisualization(fullTimeDomain);
}).catch(err => console.error("Error loading data:", err));

function getGlucoseAtTime(participantId, time) {
  const partData = allGlucoseData.filter(d => d.participant_id === participantId);
  if (partData.length === 0) return null;
  let closest = partData[0];
  let minDiff = Math.abs(partData[0].TimeInMinutes - time);
  partData.forEach(d => {
    const diff = Math.abs(d.TimeInMinutes - time);
    if (diff < minDiff) {
      closest = d;
      minDiff = diff;
    }
  });
  return closest.Glucose;
}

function updateVisualization(timeDomain) {
  d3.select("#food-visualization").select("svg").remove();

  const selectedParticipants = Array.from(document.querySelectorAll(".participant-checkbox:checked"))
                                    .map(cb => cb.value);
  let glucoseData = allGlucoseData.filter(d => selectedParticipants.includes(d.participant_id));
  let mealData = allMealData.filter(d => selectedParticipants.includes(d.participant_id));

  if (document.getElementById("high-sugar").checked) {
    mealData = mealData.filter(d => d.sugar > 50);
  }
  if (document.getElementById("high-calorie").checked) {
    mealData = mealData.filter(d => d.calorie > 300);
  }

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
    .call(d3.zoom().scaleExtent([1, 10]).on("zoom", ({transform}) => {
      svg.attr("transform", transform);
    }))
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear()
    .domain(timeDomain)
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
    .text("Glucose (mg/dL)");

  const lineGenerator = d3.line()
    .x(d => x(d.TimeInMinutes))
    .y(d => y(d.Glucose));

  dataByParticipant.forEach((values, participant) => {
    const path = svg.append("path")
       .datum(values)
       .attr("fill", "none")
       .attr("stroke", participantColors[participant] || "steelblue")
       .attr("stroke-width", 1.5)
       .attr("d", lineGenerator);

    const totalLength = path.node().getTotalLength();
    path
      .attr("stroke-dasharray", totalLength + " " + totalLength)
      .attr("stroke-dashoffset", totalLength)
      .transition()
      .duration(2000)
      .ease(d3.easeLinear)
      .attr("stroke-dashoffset", 0);
  });

  svg.selectAll("circle.meal-dot")
    .data(mealData)
    .enter()
    .append("circle")
    .attr("class", "meal-dot")
    .attr("cx", d => x(d.TimeInMinutes))
    .attr("cy", d => {
      const gValue = getGlucoseAtTime(d.participant_id, d.TimeInMinutes);
      return gValue !== null ? y(gValue) : y((yMin + yMax) / 2);
    })
    .attr("r", 5)
    .attr("fill", "black")
    .attr("stroke", "white")
    .attr("stroke-width", 1)
    .on("click", (event, d) => {
      d3.select("#tooltip")
        .html(`
          <p><strong>Meal:</strong> ${d.logged_food}</p>
          <p><strong>Time (min):</strong> ${d.TimeInMinutes.toFixed(0)}</p>
          <p><strong>Calories:</strong> ${d.calorie}</p>
          <p><strong>Total Carbs:</strong> ${d.total_carb}</p>
          <p><strong>Sugar:</strong> ${d.sugar}</p>
        `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 20) + "px")
        .style("display", "block");
      event.stopPropagation();
    })
    .on("mouseover", function(event, d) {
      d3.select(this).attr("fill", "darkred");
    })
    .on("mouseout", function(event, d) {
      d3.select(this).attr("fill", "black");
    });

  d3.select("body").on("click", function(event) {
    if (!event.target.closest(".meal-dot")) {
      d3.select("#tooltip").style("display", "none");
    }
  });
}

document.querySelectorAll(".participant-checkbox, #high-sugar, #high-calorie").forEach(input => {
  input.addEventListener("change", () => {
    updateVisualization(fullTimeDomain);
  });
});

document.querySelectorAll(".day-button").forEach(button => {
  button.addEventListener("click", function() {
    const day = +this.getAttribute("data-day");
    const dayStart = (day - 1) * 1440;
    const dayEnd = day * 1440;
    updateVisualization([dayStart, dayEnd]);
  });
});

document.addEventListener("DOMContentLoaded", function () {
  const darkModeToggle = document.getElementById("dark-mode-toggle");
  const body = document.body;

  // Check for saved preference
  if (localStorage.getItem("dark-mode") === "enabled") {
    body.classList.add("dark-mode");
  }

  // Toggle dark mode on button click
  darkModeToggle.addEventListener("click", function () {
    body.classList.toggle("dark-mode");

    // Save user preference
    if (body.classList.contains("dark-mode")) {
      localStorage.setItem("dark-mode", "enabled");
    } else {
      localStorage.setItem("dark-mode", "disabled");
    }
  });
});


updateVisualization(fullTimeDomain);