// Reference Board
function createReferenceBoard() {
    let element;
    let targetTableData;

    //stages
    const rectColors = ["rgb(49, 197, 255)", "rgb(220, 199, 255)", "yellow", "rgb(169, 255, 163)", "rgb(255, 94, 105)"];
    for (var i = 0; i < rectColors.length; i++) {
        element = createRBRect(50, 20, rectColors[i]);
        targetTableData = $(`table#rects_table tr:eq(${i + 1}) td:eq(1)`)[0];
        targetTableData.appendChild(element);
    }

    //links
    const links = ["black"];
    const dasharray = ["0"];
    for (var j = 0; j < links.length; j++) {
        element = createRBlink(links[j], dasharray[j]);
        targetTableData = $(`table#links_table tr:eq(${j + 1}) td:eq(1)`)[0];
        targetTableData.appendChild(element);
    }

    //others
    targetTableData = $(`table#others_table tr:eq(1) td:eq(1)`)[0];
    element = createRBOthers('start');
    targetTableData.appendChild(element);

    targetTableData = $(`table#others_table tr:eq(2) td:eq(1)`)[0];
    element = createRBOthers('end');
    targetTableData.appendChild(element);

    targetTableData = $(`table#others_table tr:eq(3) td:eq(1)`)[0];
    element = createRBOthers('decision');
    targetTableData.appendChild(element);

    targetTableData = $(`table#others_table tr:eq(4) td:eq(1)`)[0];
    element = createRBOthers('action');
    targetTableData.appendChild(element);
}

function createRBRect(width = 50, height = 20, fillColor) {
    //create element with specific namespace
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("stroke-width", "2");
    rect.setAttribute("stroke", "black");
    rect.setAttribute("fill", fillColor);
    rect.setAttribute("width", width);
    rect.setAttribute("height", height);

    svg.appendChild(rect);
    return svg;
}

function createRBlink(fillColor, dasharray) {

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", 50);
    svg.setAttribute("height", 20);

    const pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathElement.setAttribute("stroke-width", "2");
    pathElement.setAttribute("fill", "none");
    pathElement.setAttribute("stroke", fillColor);
    pathElement.setAttribute("d", "M0 10 L50 10");
    pathElement.setAttribute("stroke-dasharray", dasharray);

    svg.appendChild(pathElement);
    return svg;
}

function createRBOthers(elementType) {

    let svg;
    let element;
    let element2;

    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", 50);
    svg.setAttribute("height", 35);

    switch (elementType) {
        case 'start':
            element = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            element.setAttribute("cx", "50%");
            element.setAttribute("cy", "50%");
            element.setAttribute("stroke-width", '2');
            element.setAttribute("stroke", 'black');
            element.setAttribute("r", '10');
            element.setAttribute("fill", 'black');
            svg.appendChild(element);
            break;

        case 'end':
            element = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            element.setAttribute("cx", "50%");
            element.setAttribute("cy", "50%");
            element.setAttribute("stroke-width", '1');
            element.setAttribute("stroke", 'black');
            element.setAttribute("r", '10');
            element.setAttribute("fill", 'transparent');

            element2 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            element2.setAttribute("cx", "50%");
            element2.setAttribute("cy", "50%");
            element2.setAttribute("stroke-width", '2');
            element2.setAttribute("stroke", 'black');
            element2.setAttribute("r", '6');
            element2.setAttribute("fill", 'black');
            svg.appendChild(element);
            svg.appendChild(element2);

            break;

        case 'decision':
            element = document.createElementNS("http://www.w3.org/2000/svg", "path");
            element.setAttribute("stroke-width", "2");
            element.setAttribute("fill", "white");
            element.setAttribute("stroke", 'black');

            element.setAttribute("d", "M 25 0 L 40 15 L 25 30 L 10 15 z");
            svg.appendChild(element);
            break;

        case 'action':
            element = document.createElementNS("http://www.w3.org/2000/svg", "rect");

            element.setAttribute("y", "25%");
            element.setAttribute("stroke-width", "2");
            element.setAttribute("stroke", "black");
            element.setAttribute("fill", 'transparent');
            element.setAttribute("width", 50);
            element.setAttribute("height", 20);

            element2 = document.createElementNS("http://www.w3.org/2000/svg", "text");
            element2.setAttribute("x", '50%');
            element2.setAttribute("y", '60%');
            element2.setAttribute("font-size", "11");
            element2.setAttribute("text-anchor", "middle");
            element2.setAttribute("fill", 'black');
            element2.textContent = "Action";


            svg.appendChild(element);
            svg.appendChild(element2);

        // <rect joint-selector="labelBody" id="v-158" rx="2" ry="2" fill="white" stroke="black" x="-32.3359375" y="-10.399999618530273" width="64.671875" height="20"></rect>
        // <text joint-selector="labelText" id="v-157" font-size="12" xml:space="preserve" fill="#333" font-family="sans-serif" font-weight="bold" text-anchor="middle"><tspan dy="0.3em" class="v-line">Submitted</tspan></text>
        // break;

        default:
            break;
    }

    return svg;


}

createReferenceBoard();
