import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

let allGlucoseData, allMealData;
const fullTimeDomain = [0, 14400]; // Full domain in minutes (10 days)
const minutesPerDay = 1440;

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
  console.log("Glucose Data Loaded:", glucoseData.length);
  console.log("Meal Data Loaded:", mealData.length);

  if (!glucoseData.length || !mealData.length) {
    console.error("No data loaded. Check CSV file paths.");
    return;
  }

  const participantsToShow = ["001", "006", "011"];
  allGlucoseData = glucoseData.filter(d => participantsToShow.includes(d.participant_id));
  allMealData = mealData.filter(d => participantsToShow.includes(d.participant_id));

  console.log("Filtered Glucose Data:", allGlucoseData);
  console.log("Filtered Meal Data:", allMealData);

  // Only call updateVisualization if data exists
  if (allGlucoseData.length > 0) {
    updateVisualization(fullTimeDomain);
  } else {
    console.error("No valid glucose data available.");
  }
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
  // Remove previous SVG if it exists
  d3.select("#food-visualization").select("svg").remove();
  console.log("🟢 Running updateVisualization...");
  console.log("🔹 Checking allGlucoseData:", allGlucoseData);
  console.log("🔹 Checking allMealData:", allMealData);

  if (!allGlucoseData || !Array.isArray(allGlucoseData)) {
    console.error("❌ Error: allGlucoseData is not an array or is undefined.");
    return;
  }

  if (!allMealData || !Array.isArray(allMealData)) {
    console.error("❌ Error: allMealData is not an array or is undefined.");
    return;
  }

  console.log("✅ All Glucose Data Length:", allGlucoseData.length);
  console.log("✅ All Meal Data Length:", allMealData.length);

  // Get selected participants
  const selectedParticipants = Array.from(document.querySelectorAll(".participant-checkbox:checked"))
                                    .map(cb => cb.value);

  console.log("✅ Selected Participants:", selectedParticipants);

  if (!selectedParticipants || selectedParticipants.length === 0) {
    console.error("❌ Error: No selected participants.");
    return;
  }

  // Check if participant_id exists in data
  console.log("First glucose data object:", allGlucoseData[0]);

  if (!allGlucoseData[0].hasOwnProperty("participant_id")) {
    console.error("❌ Error: participant_id key is missing in glucose data.");
    return;
  }

  let glucoseData = allGlucoseData.filter(d => selectedParticipants.includes(d.participant_id));

  // Apply meal filters (sugar, calorie, and carb)
  if (document.getElementById("high-sugar").checked) {
    mealData = mealData.filter(d => d.sugar > 50);
  }
  if (document.getElementById("high-calorie").checked) {
    mealData = mealData.filter(d => d.calorie > 300);
  }
  if (document.getElementById("high-carb").checked) {
    mealData = mealData.filter(d => d.total_carb > 50);
  }


  // Define margins and dimensions
  const margin = { top: 20, right: 40, bottom: 50, left: 60 };
  const width = 960 - margin.left - margin.right;
  const height = 500 - margin.top - margin.bottom;

  // Create SVG element
  const svg = d3.select("#food-visualization")
                .append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

  // Use a continuous linear x-scale over the full domain
  const x = d3.scaleLinear()
              .domain(timeDomain)
              .range([0, width]);

  // Set zoom condition: if domain span is <= one day, consider it zoomed in.
  const isZoomedIn = (timeDomain[1] - timeDomain[0]) <= minutesPerDay;

  // Define x-axis with conditional tick formatting
  let xAxis;
  if (isZoomedIn) {
    // When zoomed in, display ticks as "HH:MM (Day X)"
    xAxis = d3.axisBottom(x)
              .tickFormat(d => {
                let day = Math.floor(d / minutesPerDay) + 1;
                let local = d % minutesPerDay;
                let hours = Math.floor(local / 60);
                let minutes = Math.floor(local % 60);
                return `${hours}:${minutes.toString().padStart(2, '0')} (Day ${day})`;
              });
  } else {
    // For full view, display ticks as "Day X"
    xAxis = d3.axisBottom(x)
              .tickFormat(d => "Day " + (Math.floor(d / minutesPerDay) + 1));
  }

  // Add x-axis and label
  svg.append("g")
     .attr("class", "x-axis")
     .attr("transform", `translate(0, ${height})`)
     .call(xAxis);
  svg.append("text")
     .attr("class", "axis-label")
     .attr("x", width / 2)
     .attr("y", height + margin.bottom - 5)
     .attr("text-anchor", "middle")
     .text(isZoomedIn ? "Time (HH:MM) (Day X)" : "Day");

  // Define y-scale for glucose values
  const yMin = d3.min(glucoseData, d => d.Glucose);
  const yMax = d3.max(glucoseData, d => d.Glucose);
  const y = d3.scaleLinear()
              .domain([yMin - 5, yMax + 5])
              .range([height, 0]);

  // Add y-axis and label
  svg.append("g")
     .attr("class", "y-axis")
     .call(d3.axisLeft(y));
  svg.append("text")
     .attr("class", "axis-label")
     .attr("transform", "rotate(-90)")
     .attr("x", -height / 2)
     .attr("y", -40)
     .attr("text-anchor", "middle")
     .text("Glucose (mg/dL)");

  // ---------------------
  // Draw glucose lines – add a class to identify participant's line
  const lineGenerator = d3.line()
                          .x(d => x(d.TimeInMinutes))
                          .y(d => y(d.Glucose));

  const dataByParticipant = d3.group(glucoseData, d => d.participant_id);
  dataByParticipant.forEach((values, participant) => {
    values = values.filter(d => d.TimeInMinutes >= timeDomain[0] && d.TimeInMinutes <= timeDomain[1]);
    if (values.length === 0) return;
    svg.append("path")
       .datum(values)
       .attr("class", "glucose-line " + participant) // include participant id in class
       .attr("fill", "none")
       .attr("stroke", participantColors[participant] || "steelblue")
       .attr("stroke-width", 1.5)
       .attr("d", lineGenerator)
       .call(path => {
         const totalLength = path.node().getTotalLength();
         path.attr("stroke-dasharray", totalLength + " " + totalLength)
             .attr("stroke-dashoffset", totalLength)
             .transition()
             .duration(2000)
             .ease(d3.easeLinear)
             .attr("stroke-dashoffset", 0);
       });
  });

  // ---------------------
  // Draw meal dots with tooltip and response animation on click
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
       // Format meal time as "HH:MM (Day X)"
       let day = Math.floor(d.TimeInMinutes / minutesPerDay) + 1;
       let local = d.TimeInMinutes % minutesPerDay;
       let hours = Math.floor(local / 60);
       let minutes = Math.floor(local % 60);
       let formattedTime = `${hours}:${minutes.toString().padStart(2, '0')} (Day ${day})`;
       
       // Show tooltip with meal details
       d3.select("#tooltip")
         .html(
           `<p><strong>Meal:</strong> ${d.logged_food}</p>
            <p><strong>Time:</strong> ${formattedTime}</p>
            <p><strong>Calories:</strong> ${d.calorie}</p>
            <p><strong>Total Carbs:</strong> ${d.total_carb}</p>
            <p><strong>Sugar:</strong> ${d.sugar}</p>`
         )
         .style("left", (event.clientX + 10) + "px")
         .style("top", (event.clientY - 20) + "px")
         .style("display", "block");
       event.stopPropagation();
       
       // Dim all glucose lines except the one for this participant
       svg.selectAll("path.glucose-line")
          .transition().duration(500)
          .style("opacity", function() {
            return this.classList.contains(d.participant_id) ? 1 : 0.2;
          });
       
       // Start the response animation for the next 3 hours after the meal
       animateGlucoseResponse(d.participant_id, d.TimeInMinutes);
     })
     .on("mouseover", function(event, d) {
       d3.select(this).attr("fill", "darkred");
     })
     .on("mouseout", function(event, d) {
       d3.select(this).attr("fill", "black");
     });

  // Hide tooltip when clicking outside meal dots
  d3.select("body").on("click", function(event) {
    if (!event.target.closest(".meal-dot")) {
      d3.select("#tooltip").style("display", "none");
    }
  });

  // ---------------------
  // Define Glucose Response Animation:
  // This function dims the chart (except the selected participant's line), then
  // animates a moving marker along the glucose line for 3 hours after the meal.
  function animateGlucoseResponse(participantId, mealTime) {
    const responseDuration = 180; // minutes (3 hours)
    // Filter glucose data for the response period for this participant
    const responseData = allGlucoseData.filter(d =>
      d.participant_id === participantId &&
      d.TimeInMinutes >= mealTime &&
      d.TimeInMinutes <= mealTime + responseDuration
    );
    if (responseData.length === 0) return;
    
    // Append a marker for the animation
    const marker = svg.append("circle")
                      .attr("class", "response-marker")
                      .attr("r", 8)
                      .attr("fill", "orange")
                      .attr("stroke", "red")
                      .attr("stroke-width", 2);
    // Set initial position at meal time
    marker.attr("cx", x(mealTime))
          .attr("cy", y(getGlucoseAtTime(participantId, mealTime)));
    
    const totalAnimDuration = 3000; // total animation duration in ms
    
    const timer = d3.timer(function(elapsed) {
      let progress = elapsed / totalAnimDuration;
      let currentTime = mealTime + progress * responseDuration;
      if (currentTime > mealTime + responseDuration) {
        timer.stop();
        marker.remove();
        // Restore opacity for all glucose lines
        svg.selectAll("path.glucose-line")
           .transition().duration(500)
           .style("opacity", 1);
        return;
      }
      // Update marker position based on current time
      marker.attr("cx", x(currentTime))
            .attr("cy", y(getGlucoseAtTime(participantId, currentTime)));
    });
  }

  // ---------------------
  // BRUSH-BASED ZOOM
  const brush = d3.brushX()
                  .extent([[0, 0], [width, height]])
                  .on("end", brushed);
  svg.append("g")
     .attr("class", "brush")
     .call(brush);
  // Bring meal dots to front so tooltip remains accessible
  svg.selectAll("circle.meal-dot").raise();

  function brushed({selection}) {
    if (!selection) return;
    let [x0, x1] = selection;
    // Convert pixel selection to time values
    let t0 = x.invert(x0);
    let t1 = x.invert(x1);
    let newDomain;
    if (!isZoomedIn) {
      // Snap to full day boundaries (round down/up)
      let day0 = Math.floor(t0 / minutesPerDay);
      let day1 = Math.ceil(t1 / minutesPerDay);
      newDomain = [day0 * minutesPerDay, day1 * minutesPerDay];
    } else {
      newDomain = [t0, t1];
    }
    // Clear the brush selection
    svg.select(".brush").call(brush.move, null);
    // Update visualization with the new domain
    updateVisualization(newDomain);
  }
}

// Reset zoom button to restore the full view
document.getElementById("resetZoom").addEventListener("click", () => {
  updateVisualization(fullTimeDomain);
});

// Re-render visualization when any filter changes
document.querySelectorAll(".participant-checkbox, #high-sugar, #high-calorie, #high-carb")
  .forEach(input => {
    input.addEventListener("change", () => {
      updateVisualization(fullTimeDomain);
    });
  });

// Initial render
updateVisualization(fullTimeDomain);



document.addEventListener("DOMContentLoaded", function () {
  const darkModeToggle = document.getElementById("dark-mode-toggle");

  if (!darkModeToggle) {
    console.error("Dark mode button not found!");
    return;
  }

  // Apply saved dark mode preference
  if (localStorage.getItem("dark-mode") === "enabled") {
    document.body.classList.add("dark-mode");
  }

  // Toggle dark mode when clicking the button
  darkModeToggle.addEventListener("click", function () {
    document.body.classList.toggle("dark-mode");

    console.log("Dark mode toggled!"); // Debugging log
    console.log("Current body class:", document.body.classList);

    // Save dark mode setting
    if (document.body.classList.contains("dark-mode")) {
      localStorage.setItem("dark-mode", "enabled");
    } else {
      localStorage.setItem("dark-mode", "disabled");
    }
  });
});

document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".expand-btn").forEach(button => {
    button.addEventListener("click", function () {
      const parent = this.closest(".expandable");
      const content = parent.querySelector(".expandable-content");

      if (parent.classList.contains("expanded")) {
        parent.classList.remove("expanded");
        content.style.maxHeight = "50px"; // Collapse
        this.innerText = "Read More ▼";
      } else {
        parent.classList.add("expanded");
        content.style.maxHeight = "1000px"; // Expand
        this.innerText = "Collapse ▲";
      }
    });
  });
});
