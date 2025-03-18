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
  // Remove previous SVG if it exists
  d3.select("#food-visualization").select("svg").remove();

  // Get selected participants
  const selectedParticipants = Array.from(document.querySelectorAll(".participant-checkbox:checked"))
                                    .map(cb => cb.value);
  let glucoseData = allGlucoseData.filter(d => selectedParticipants.includes(d.participant_id));
  let mealData = allMealData.filter(d => selectedParticipants.includes(d.participant_id));

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

  // Enforce strict boundaries based on current timeDomain
  glucoseData = glucoseData.filter(d => d.TimeInMinutes >= timeDomain[0] && d.TimeInMinutes <= timeDomain[1]);
  mealData = mealData.filter(d => d.TimeInMinutes >= timeDomain[0] && d.TimeInMinutes <= timeDomain[1]);

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

  // Determine zoom level: if domain span is less than one day, we're zoomed in.
  const isZoomedIn = (timeDomain[1] - timeDomain[0]) < minutesPerDay;

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

  // Line generator for glucose values
  const lineGenerator = d3.line()
                          .x(d => x(d.TimeInMinutes))
                          .y(d => y(d.Glucose));

  // Draw glucose lines for each participant with animation
  const dataByParticipant = d3.group(glucoseData, d => d.participant_id);
  dataByParticipant.forEach((values, participant) => {
    values = values.filter(d => d.TimeInMinutes >= timeDomain[0] && d.TimeInMinutes <= timeDomain[1]);
    if (values.length === 0) return;
    const path = svg.append("path")
       .datum(values)
       .attr("fill", "none")
       .attr("stroke", participantColors[participant] || "steelblue")
       .attr("stroke-width", 1.5)
       .attr("d", lineGenerator);
    const totalLength = path.node().getTotalLength();
    path.attr("stroke-dasharray", totalLength + " " + totalLength)
        .attr("stroke-dashoffset", totalLength)
        .transition()
        .duration(2000)
        .ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0);
  });

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
       
       // Show tooltip with meal details and formatted time
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
       
       // Start the glucose response animation for the next 3 hours after the meal
       animateGlucoseResponse(d.participant_id, d.TimeInMinutes);
     })
     .on("mouseover", function(event, d) {
       d3.select(this).attr("fill", "darkred");
     })
     .on("mouseout", function(event, d) {
       d3.select(this).attr("fill", "black");
     });

  // Hide tooltip when clicking elsewhere
  d3.select("body").on("click", function(event) {
    if (!event.target.closest(".meal-dot")) {
      d3.select("#tooltip").style("display", "none");
    }
  });

  // --- Define Glucose Response Animation ---
  // This function animates a moving marker along the glucose line for 3 hours after the meal.
  function animateGlucoseResponse(participantId, mealTime) {
    const responseDuration = 180; // minutes (3 hours)
    // Filter glucose data for the response period (for the given participant)
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
    const startTime = Date.now();
    
    // Use d3.timer to update the marker position over the animation duration
    const timer = d3.timer(function(elapsed) {
      let progress = elapsed / totalAnimDuration;
      let currentTime = mealTime + progress * responseDuration;
      if (currentTime > mealTime + responseDuration) {
        timer.stop();
        marker.remove();
        return;
      }
      // Update marker position based on current time
      marker.attr("cx", x(currentTime))
            .attr("cy", y(getGlucoseAtTime(participantId, currentTime)));
    });
  }

  // --- BRUSH-BASED ZOOM ---
  const brush = d3.brushX()
                  .extent([[0, 0], [width, height]])
                  .on("end", brushed);
  svg.append("g")
     .attr("class", "brush")
     .call(brush);
  // Bring meal dots to the front so the tooltip remains accessible
  svg.selectAll("circle.meal-dot").raise();

  function brushed({selection}) {
    if (!selection) return;
    let [x0, x1] = selection;
    // Convert pixel selection to time values
    let t0 = x.invert(x0);
    let t1 = x.invert(x1);
    let newDomain;
    if (!isZoomedIn) {
      // Snap to full day boundaries: round down/up to nearest day
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

