// Function to handle the click event
function handleClick(event) {
    // Get the coordinates of the click event
    const x = event.clientX-8;
    const y = event.clientY-8;
  
    var coordinator = document.getElementById("coordinator");
    coordinator.innerHTML = `(<b>x</b>: ${x}, <b>y</b>: ${y}) `;

  }
  
  // Add a click event listener to the document
  document.addEventListener("mousemove", handleClick);
  