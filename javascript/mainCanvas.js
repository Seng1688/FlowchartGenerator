//destructuring assignment
const { shapes, util, dia, anchors, mvc } = joint;
const rectWidth = 140;
const rectHeight = 60;
let totalWorkflows;
let workflowNo = 1;
let mainPaper;
let rectDataArray = [];
let adjacencyList = {};
let elements = [];
let links = [];
let controls;
let branchCounter = 1; // to prevent 'json-dom-parser: selector must be unique' error


// extend mvc view and add custom control
var LayoutControls = mvc.View.extend({
  events: {
    change: "onChange",
    input: "onChange",
  },

  options: {
    padding: 50,
  },

  init: function () {
    var options = this.options;
    options.cells = createElements(options.elementsArray, options.linksArray, options.rectDataArray);

    // add eventlinstener to the paper's elements
    this.listenTo(options.paper.model, "change", function (_, opt) {
      console.log('aa');
      if (opt.layout) {
        this.layout();
      }
    });
  },

  onChange: function () {
    this.layout();
    this.trigger("layout");
  },

  layout: function () {

    let paper = this.options.paper;
    let graph = paper.model;
    let cells = this.options.cells;
    graph.resetCells(cells);

    // add link view tools for each link
    cells.forEach(element => {
      if (element.isLink()) {
        let linkView = paper.findViewByModel(element);
        linkView.addTools(createLinkTools());
        linkView.hideTools();
      }
    });

    paper.on("link:mouseover", (linkView) => {
      linkView.showTools();
    })

    paper.on("link:mouseout", (linkView) => {
      linkView.hideTools();
    })




    paper.freeze();
    joint.layout.DirectedGraph.layout(graph, this.getLayoutOptions());

    if (graph.getCells().length === 0) {
      // The graph could be empty at the beginning to avoid cells rendering
      // and their subsequent update when elements are translated
    }

    paper.fitToContent({
      padding: this.options.padding,
      allowNewOrigin: "any",
      useModelGeometry: true,
    });
    paper.unfreeze();


  },

  getLayoutOptions: function () {
    return {
      dagre: dagre,
      graphlib: dagre.graphlib,
      setVertices: true,
      setLabels: true,
      ranker: this.$(".ranker").val(),
      rankDir: this.$(".rankdir").val(),
      align: this.$(".align").val(),
      rankSep: parseInt(this.$(".ranksep").val(), 15),
      edgeSep: parseInt(this.$(".edgesep").val(), 15),
      nodeSep: parseInt(this.$(".nodesep").val(), 15),
    };
  },
});

// custom shape element for 'parallel'
var ParallelRect = dia.Element.define(
  "custom.CustomElement",
  {
    attrs: {
      header: {
        width: "calc(w)",
        height: "calc(h -calc(h -24))", //always make header height 24
        strokeWidth: 2,
        stroke: "black",
        fill: "yellow",
      },
      body: {
        width: "calc(w)",
        height: "calc(h)",
        strokeWidth: 2,
        stroke: "black",
        x: 0,
        y: 0,
        fill: "lightyellow",
      },
      titleLabel: {
        pointerEvents: "none",
        x: "calc(0.5 * w)", //middle of header
        y: "12", //middle of header
        textAnchor: "middle",
        textVerticalAnchor: "middle",
      }
    },
  },
  {
    markup: [
      {
        tagName: "rect",
        selector: "body",
      },
      {
        tagName: "rect",
        selector: "header",
      },
      {
        tagName: "text",
        selector: "titleLabel",
      },
    ],
  }
);

class UMLElement extends dia.Element {
  defaults() {
    return {
      ...super.defaults,
      hidden: false,
    };
  }

  isHidden() {
    return Boolean(this.get("hidden"));
  }

  static isUMLElement(shape) {
    return shape instanceof UMLElement;
  }
}

class UMLInitialNode extends UMLElement {
  defaults() {
    return {
      ...super.defaults(),
      type: "UMLInitialNode",
      size: { width: 30, height: 30 },
      attrs: {
        body: {
          fill: "#333",
          stroke: "black",
          strokeWidth: 2,
          cx: "calc(0.5 * w)",
          cy: "calc(0.5 * h)",
          r: "calc(0.5 * w)",
        },
      },
    };
  }

  preinitialize() {
    this.markup = util.svg`
                  <circle @selector="body" />
              `;
  }
}

class UMLEndNode extends UMLElement {
  defaults() {
    return {
      ...super.defaults(),
      type: "UMLEndNode",
      size: { width: 30, height: 30 },
      attrs: {
        body: {
          fill: "transparent",
          stroke: "#333",
          strokeWidth: 2,
          cx: "calc(0.5 * w)",
          cy: "calc(0.5 * h)",
          r: "calc(0.5 * w)",
        },
        innerCircle: {
          fill: "#333",
          stroke: null,
          cx: "calc(0.5 * w)",
          cy: "calc(0.5 * h)",
          r: "calc(0.33 * w)",
        },
      },
    };
  }

  preinitialize() {
    this.markup = util.svg`
                  <circle @selector="body" />
                  <circle @selector="innerCircle" />
              `;
  }
}

class UMLDecision extends UMLElement {
  defaults() {
    return {
      ...super.defaults(),
      type: "UMLDecision",
      size: { width: 40, height: 40 },
      attrs: {
        body: {
          strokeWidth: 2,
          d: "M calc(0.5 * w) 0 L calc(w) calc(0.5 * h) L calc(0.5 * w) calc(h) L 0 calc(0.5 * h) z",
        },
      },
    };
  }

  preinitialize() {
    this.markup = util.svg`
                  <path @selector="body" />
              `;
  }
}

const cellNamespace = {
  UMLInitialNode,
  UMLEndNode,
  UMLDecision,
};

function createAdjacencyList() {
  // add startNode to the list
  let index = rectDataArray.findIndex(function (rectData) {
    return rectData.seqNo === 1;
  });
  adjacencyList["startNode"] = [rectDataArray[index].currentStageId.toString()];

  // add rect(s) to the list
  for (let i = 0; i < rectDataArray.length; i++) {
    let parentStageId = rectDataArray[i].currentStageId;
    let childs = [];

    for (let j = 0; j < rectDataArray[i].nextStages.length; j++) {
      let childStageId = rectDataArray[i].nextStages[j].stageId.toString();
      childs.push(childStageId);
    }
    adjacencyList[parentStageId] = childs;
  }

  // add endNode to the list
  let lastStageRects = [];
  lastStageRects = rectDataArray.filter(function (rectData) {
    return rectData.nextStages.length === 0;
  });

  lastStageRects.forEach((rect) => {
    let parentId = rect.currentStageId.toString();
    adjacencyList[parentId] = ["endNode"];
  });
  adjacencyList["endNode"] = [];
}

function createPaper(holderId) {
  return new dia.Paper({
    el: document.getElementById(holderId),
    gridSize: 15,
    drawGrid: {
      name: "mesh",
      color: "black",
      thickness: 0.2,
    },
    background: {
      color: "white",
    },
    snapLabels: true,
    defaultRouter: { name: "orthogonal" },
    linkPinning: false,
    interactive: function (cellView) {
      if (cellView.model.get("isLocked")) {
        return {
          elementMove: false,
        };
      }
      // otherwise
      return {
        snapLink: true,
        useLinkTools: true,
        vertexAdd: true,
        arrowheadMove: true,
        linkMove: true,
        labelMove: true,
        vertexMove: true,
        vertexRemove: true,



      };
    },
  });
}

function createStartNode(elementsArray) {
  const startNode = new UMLInitialNode({
    id: "startNode",
    name: "startNode",
    isLocked: true,
  });

  elementsArray.push(startNode);
}

function createEndNode(elementsArray) {
  const endNode = new UMLEndNode({
    id: "endNode",
  });
  elementsArray.push(endNode);
}

// dataArray - an array that contains multiple rectData that will be wrapped with a rectangle
// elementsArray - an array to store the generated rectangle
function createRectangles(dataArray, elementsArray) {
  dataArray.forEach((rectData) => {
    var stageType = rectData.stageType;
    var fillValue = getColorBasedOnStageType(
      rectData.stageType,
      rectData.isEndStage,
      rectData.isApprovedStage
    );
    var Rect;

    if (stageType === "Parallel") {
      Rect = createParallelRect(rectData);
    } else {
      Rect = createStandardRect(rectData, fillValue);
    }
    elementsArray.push(Rect);
  });
}

function createStandardRect(rectData, fillValue) {
  const Rect = new shapes.standard.Rectangle({
    id: rectData.currentStageId.toString(),
    size: { width: rectWidth, height: rectHeight },
    attrs: {
      body: {
        fill: fillValue,
        stroke: "black",
        strokeWidth: 2,
      },

      label: {
        text: rectData.currentStageName,
        fill: "black",
      },
    },
    seqNo: rectData.seqNo,
  });
  return Rect;
}

function createParallelRect(rectData) {

  var parallel = new ParallelRect({
    id: rectData.currentStageId.toString(),
    currentStageName: rectData.currentStageName,
    size: { width: 100, height: 80 },
    attrs: {
      titleLabel: {
        text: rectData.currentStageName,
      },
    },
  });

  let bodyW = parallel.attributes.size.width;
  let bodyH = parallel.attributes.size.height;
  let childWidth = bodyW - 10;
  let childHeight = bodyH - 24 - 10;
  let offsetX = (bodyW - childWidth) / 2;
  let offsetY = (bodyH - 24 - childHeight) / 2;
  let bodyXIncrement = childWidth + offsetX;
  let bodyYIncrement = childHeight + offsetY;
  let level = 1; // to calculate offsetY for each branch
  let counter = 1; // to calculate offsetX for each branch

  for (let i = 0; i < rectData.branches.length; i++) {

    // bind parallelSet with label
    const parallelSet = rectData.parallelSets[i]

    // update width and height of element dynamically
    if (i < 3 && i !== 0) {
      parallel.attributes.size.width += bodyXIncrement;
    } else if (i != 0 && i % 3 == 0) {
      parallel.attributes.size.height += bodyYIncrement;
      level++;
    }

    // update counter
    if (counter == 4) {
      counter = 1;
    }

    // create branch sub-elements
    var branchMarkup = {
      tagName: "rect",
      selector: "branch" + branchCounter,
    };

    // define attribute for branch
    parallel.attr("branch" + branchCounter, {
      ref: "body",
      width: childWidth,
      height: childHeight,
      refX: counter * offsetX + (counter - 1) * childWidth,
      refY: level * offsetY + (level - 1) * childHeight + 24, //24 = header height
      strokeWidth: 1,
      stroke: "black",
      fill: "white",
    });
    parallel.markup.push(branchMarkup);

    // create branch's label subelements
    var branchLabelMarkup = {
      tagName: "text",
      selector: "branch" + branchCounter + "_label",
    };

    // define attribute for branch's label subelements
    parallel.attr("branch" + branchCounter + "_label", {
      ref: "branch" + branchCounter,
      cursor: 'pointer',
      event: 'element:branchLabel:pointerdown',
      textAnchor: "middle",
      textVerticalAnchor: "middle",
      text: rectData.branches[i].branchName,
      refX: "50%",
      refY: "50%",
      parallelSet: parallelSet,
      class: "branchLabel",
    });
    parallel.markup.push(branchLabelMarkup);

    branchCounter++;
    counter++;
  }

  return parallel;
}

function createDecisionPolygon(dataArray, elementsArray) {
  dataArray.forEach((rectData) => {
    let childSize = rectData.nextStages.length;
    let parentId = rectData.currentStageId;
    let seqNo = rectData.seqNo;
    if (childSize > 1) {
      const decisionPolygon = new UMLDecision({
        attrs: {
          root: {
            title: "joint.shapes.standard.Polygon",
          },
          label: {
            text: "",
          },
          body: {
            fill: "white",
            stroke: "black",
          },
        },
        parentId,
        seqNo,
      });

      elementsArray.push(decisionPolygon);
    }
  });
}

function createLink(linksArray, source, target, { sourceSide, dx: sourceDx = 0, dy: sourceDy = 0 }, { targetSide, dx: targetDx = 0, dy: targetDy = 0 }, actionLabel = "", isReturnLink, isResubmission = false) {
  const link = new shapes.standard.Link({
    source: {
      id: source,
      anchor: { name: sourceSide, args: { dx: sourceDx, dy: sourceDy } },
    },
    target: {
      id: target,
      anchor: { name: targetSide, args: { dx: targetDx, dy: targetDy } },
    },
    defaultLabel: {
      markup: util.svg`
                            <rect @selector="labelBody" />
                            <text @selector="labelText" />
                        `,
      attrs: {
        labelText: {
          fill: "#333",
          fontSize: 12,
          fontFamily: "sans-serif",
          fontWeight: "bold",
          textAnchor: "middle",
          textVerticalAnchor: "middle",
        },
        labelBody: {
          rx: 2,
          ry: 2,
          ref: "labelText",
          x: "calc(x - 3)",
          y: "calc(y - 3)",
          width: "calc(w + 6)",
          height: "calc(h + 6)",
          fill: "white",
          stroke: "black",
        },
      },
    },

    attrs: {
      line: {
        stroke: 'black',
        'stroke-width': 2,
      },
    },
    connector: {
      name: "straight",
    },
    smooth: false,
  });

  if (isReturnLink && !isResubmission) {
    link.attr({
      line: {
        stroke: 'red',
        'stroke-dasharray': '5,2'
      },
    });
  } else if (isResubmission) {
    link.attr({
      line: {
        stroke: "rgb(222, 122, 255)",
        "stroke-dasharray": "10 2 1 2",
      },
    })
  }

  if (actionLabel) {
    //check if source is a decision polygon
    let index = elements.findIndex(function (element) {
      return element.attributes.type === "UMLDecision" && element.id === source;
    });
    let isSourceDecision = index == -1 ? false : true;

    let textAnchor = "middle";
    // Make label always stay near the source/target side
    if (isSourceDecision) {
      switch (sourceSide) {
        case "left":
          textAnchor = "end";
          break;
        case "right":
          textAnchor = "start";
          break;
      }
    } else {
      switch (targetSide) {
        case "left":
          textAnchor = "end";
          break;
        case "right":
          textAnchor = "start";
          break;
      }
    }
    const labelPosition = {
      distance: isSourceDecision ? 0.35 : 0.4,
    };
    link.labels([
      {
        attrs: {
          labelText: {
            text: actionLabel,
            textAnchor,
          },
        },
        position: labelPosition,
      },
    ]);
  }
  linksArray.push(link);
}

// use the processed data to create all required elements
function createElements(elementsArray, linksArray, rectDataArray) {
  //  =========================================Create Shapes===================================================

  createStartNode(elementsArray);
  createEndNode(elementsArray);
  createRectangles(rectDataArray, elementsArray);
  createDecisionPolygon(rectDataArray, elementsArray);

  //  =========================================Create Links===================================================
  // create link for startNode
  let index = rectDataArray.findIndex(function (rectData) {
    return rectData.seqNo === 1;
  });
  createLink(linksArray, "startNode", rectDataArray[index].currentStageId, { sourceSide: "perpendicular" }, { targetSide: "perpendicular" });

  // create links for rectangles & endNode
  rectDataArray.forEach((rectData) => {
    let source = rectData.currentStageId;
    let target = "";
    let childSize = rectData.nextStages.length;
    let stageType = rectData.stageType;
    let isReturnLink = false;
    let isResubmission = false;

    if (stageType === "ReturnToRequestor") {
      isResubmission = true;
    }

    // check if it has decision and handle it
    if (childSize > 1) {
      let index = elementsArray.findIndex(function (element) {
        return element.attributes.parentId === source;
      });
      let target = elementsArray[index].id;
      createLink(linksArray, source, target, { sourceSide: "perpendicular" }, { targetSide: "perpendicular", targetDx: 0, targetDy: 50 }, "", isReturnLink, isResubmission);

      //change the Original Parent to decision polygon after connect Parent to Polygon
      source = target;
    }

    for (let i = 0; i < childSize; i++) {
      target = rectData.nextStages[i].stageId;
      isReturnLink = checkIsReturnLink(source, target);
      let actionLabel = rectData.nextStages[i].actionName;
      createLink(linksArray, source, target, { sourceSide: "perpendicular" }, { targetSide: "perpendicular", targetDx: 0, targetDy: 0 }, actionLabel, isReturnLink, isResubmission);
    }

    if (childSize == 0) {
      createLink(linksArray, source, "endNode", { sourceSide: "perpendicular" }, { targetSide: "perpendicular" });
    }

  });

  //  =========================================Concatenate all elements========================================
  return elementsArray.concat(linksArray);
}

function createLinkTools() {

  var InfoButton = joint.linkTools.Button.extend({
    name: 'info-button',
    options: {
        focusOpacity: 0.5,
        distance: 60,
        action: function(evt) {
            alert('View id: ' + this.id + '\n' + 'Model id: ' + this.model.id);
        },
        markup: [{
            tagName: 'circle',
            selector: 'button',
            attributes: {
                'r': 7,
                'fill': '#001DFF',
                'cursor': 'pointer'
            }
        }, {
            tagName: 'path',
            selector: 'icon',
            attributes: {
                'd': 'M -2 4 2 4 M 0 3 0 0 M -2 -1 1 -1 M -1 -4 1 -4',
                'fill': 'none',
                'stroke': '#FFFFFF',
                'stroke-width': 2,
                'pointer-events': 'none'
            }
        }]
    }
});

var infoButton = new InfoButton();

  var verticesTool = new joint.linkTools.Vertices({
    focusOpacity: 0.5,
    redundancyRemoval: false,
    snapRadius: 10,
    vertexAdding: false,
});
var sourceAnchorTool = new joint.linkTools.SourceAnchor({
  focusOpacity: 0.5,
  redundancyRemoval: false,
  restrictArea: false,
  snapRadius: 20
});
  var segmentsTool = new joint.linkTools.Segments();
  var boundaryTool = new joint.linkTools.Boundary();
  var removeButton = new joint.linkTools.Remove({
    focusOpacity: 0.2,
    rotate: true,
    distance: -20,
    offset: 0
  });
  var targetArrowheadTool = new joint.linkTools.TargetArrowhead({
    focusOpacity: 0.5
});
var targetAnchorTool = new joint.linkTools.TargetAnchor({
  focusOpacity: 0.5,
  redundancyRemoval: false,
  restrictArea: false,
  snapRadius: 20
});
const connectButton = new joint.linkTools.Connect({
  rotate: true,
  distance: -20,
  offset: 20,
  magnet: 'body'
});

var boundaryTool = new joint.linkTools.Boundary({
  focusOpacity: 0.5,
  padding: 20,
  useModelGeometry: true
});

  var toolsView = new joint.dia.ToolsView({
    name: 'link-tools',
    tools: [verticesTool, boundaryTool, removeButton]
  });

  return toolsView;
}


function checkIsReturnLink(sourcId, targetId) {
  let sourceSeqNo;
  let targetSeqNo;

  elements.findIndex(function (element) {
    if (element.id == sourcId) {
      sourceSeqNo = element.attributes.seqNo;
    } else if (element.id == targetId) {
      targetSeqNo = element.attributes.seqNo;
    }
  });

  // console.log(sourceSeqNo + ">" + targetSeqNo );
  return sourceSeqNo > targetSeqNo;
}

function getColorBasedOnStageType(stageType, isEndStage, isApprovedStage) {
  let fillValue;

  switch (stageType) {
    case "Standard":
    case "RequestorSubmission":
      if (isEndStage == false) {
        fillValue = "rgb(49, 197, 255)";
      } else if (isEndStage === true && isApprovedStage === true) {
        fillValue = "rgb(169, 255, 163)";
      } else if (isEndStage === true && isApprovedStage === false) {
        fillValue = "rgb(255, 94, 105)";
      }
      break;

    case "ReturnToRequestor":
      fillValue = "rgb(220, 199, 255)";
      break;

    case "Parallel":
      fillValue = "rgb(255, 242, 99)";
      break;

    default:
      fillValue = "white";
      break;
  }

  return fillValue;
}






// get raw JSON Data
function callAPI() {
  const formId = document.getElementById("formId").value;
  const holder = document.getElementById("myholder");

  // Reference to the button and result container
  const resultContainer = document.getElementById("resultContainer");

  // API endpoint URL
  const apiUrl = "https://qa1.kube365.com/api/workflows/" + formId; // Replace with your API URL

  // Bearer token (replace 'YOUR_TOKEN' with your actual token)
  const authToken =
    "eyJhbGciOiJSUzI1NiIsImtpZCI6IkYzNkI2NDUzQUQ1OEQwQTM0MTRBOTgxMDhGOEE3NkNBIiwidHlwIjoiYXQrand0In0.eyJuYmYiOjE2OTg2NDc5NDIsImV4cCI6MTY5ODY1MTU0MiwiaXNzIjoiaHR0cHM6Ly9xYWxvZ2luLmt1YmUzNjUuY29tIiwiYXVkIjpbIkt1YmUuMzY1LkFwaSIsIkt1YmUuMzY1LkFkbWluLkFwaSJdLCJjbGllbnRfaWQiOiJLdWJlLjM2NS43ZWU3YzE0OC1jMTQ0LTQ2ZWMtYmNhOS1iNzczYWZiYzZmNDUuVUkiLCJzdWIiOiJ5b25nc2VuZy5jaGlhQGlzYXRlYy5jb20iLCJhdXRoX3RpbWUiOjE2OTg2NDc5MzgsImlkcCI6IkZvcm1zIiwianRpIjoiMEI0MEExRERCNTI4MTAwNzk1QUMyN0I2OTg3RjFDNjkiLCJzaWQiOiIyQ0Q0QjA0RUZCNDQyQUI3OUQ5OTk3NjFCODU3RTY3OCIsImlhdCI6MTY5ODY0Nzk0Miwic2NvcGUiOlsib3BlbmlkIiwicHJvZmlsZSIsImt1YmUuMzY1LnNjb3BlIiwib2ZmbGluZV9hY2Nlc3MiXSwiYW1yIjpbImV4dGVybmFsIl19.n7sBAmH-OVtXkiIfPsS2U8CFoK3owatkWG2bj3hoXh4qp6BbvqxB3aq18cDDZlRRb094TfJT1z_8ov_hQe0k2fqiM1Jd2WXUtkHypkt87MM_5hsD7OiZe8-zdex1v_1Z3QkKX6izXUw_5JYRGm00LmM8ubMOQ7u_r1BkpXybql53D7Vmxpn7odPGap6EaRzE5aO0st5ohyxeuPp15qaN9YxrJ01TCsCHTGYEWVPIEFXfjy4XcW2LX5cOEwIZrboImMfjyhfr1XqutbZf5Y9ikkhNU8Xa4frwV0eA5yja1jwPK1hPmy-miDqI63zHzW4nlYoX3J70ZuR9UJrvIQnz5Q"

  // Create headers with the bearer token
  const headers = new Headers({
    Authorization: `Bearer ${authToken}`,
    "Content-Type": "application/json", // Adjust as needed
  });

  // Make a GET request to the API endpoint with the headers
  fetch(apiUrl, {
    method: "GET",
    headers: headers,
  })
    .then((response) => {
      // Check if the response status is OK (200)
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      // Parse the JSON response
      return response.json();
    })
    .then((data) => {
      // Display the API response data in the result container
      //resultContainer.innerHTML = JSON.stringify(data, null, 2);
      //resultContainer.innerHTML = data.responseData[0].workflowStages.workflowStages[0].title.key;

      processJsonData(data);
    })
    .catch((error) => {
      //Handle any errors that occurred during the fetch or processing of the data
      holder.innerHTML = `No Workflows is found on <b>Form ${formId} 😊 </b>!!`;
    });
}

// create dropdown list based on number of workflows
function createDropdownList() {
  let workflowNoSelectField = document.getElementById('workflowNo');
  workflowNoSelectField.innerHTML = "";

  for (let i = 1; i <= totalWorkflows; i++) {
    let childElement = document.createElement('option');
    childElement.value = childElement.text = i;
    workflowNoSelectField.appendChild(childElement);
  }
  workflowNoSelectField.value = workflowNo;
}

// process and get only required data from raw JSON Data
function processJsonData(data) {
  totalWorkflows = data.responseData.length;


  // initially will use first workflow
  let workflowStagesFromJSON = data.responseData[workflowNo - 1].workflowStages.workflowStages;

  // simplify workflow's details
  let workflowStages = workflowStagesFromJSON.map((w) => {
    return {
      currentStageName: w.title.key,
      currentStageId: w.workflowStageId,
      isEndStage: w.isEndStage,
      isApprovedStage: w.isApprovedStage,
      parallelCompletes: w.parallelCompletes,
      seqNo: w.seqNo,
      actions: w.actions,
      stageType: w.stageType,
      parallelSets: w.parallelSets,
    };
  });

  createDropdownList();
  createStagesData(workflowStages);
  createLayoutControl();
}

// add extra data needed for each stage
function createStagesData(workflowStages) {

  // get nextStage & branches data > push to rectDataArray
  for (let i = 0; i < workflowStages.length; i++) {
    let currentStageName = workflowStages[i].currentStageName;
    let currentStageId = workflowStages[i].currentStageId;
    let nextStages = [];
    let preStages = [];
    let branches = [];
    let isEndStage = workflowStages[i].isEndStage;
    let isApprovedStage = workflowStages[i].isApprovedStage;
    let seqNo = workflowStages[i].seqNo;
    let hasDecision = false;
    let stageType = workflowStages[i].stageType;
    let parallelSets = workflowStages[i].parallelSets;

    let actionLength =
      stageType == "Parallel"
        ? workflowStages[i].parallelCompletes.length
        : workflowStages[i].actions.length;

    let branchesLength = workflowStages[i].parallelSets.length;

    // get nextStage data
    for (let j = 0; j < actionLength; j++) {
      let stageName;
      let actionName;
      let stageId;

      if (stageType === "Parallel") {
        stageName =
          workflowStages[i].parallelCompletes[j].actions[0].stageTitle.key;
        actionName = workflowStages[i].parallelCompletes[j].title.key;
        stageId =
          workflowStages[i].parallelCompletes[j].actions[0].workflowStageId;
      } else {
        stageName =
          workflowStages[i].actions[j].eventLists[0].events[0].stageTitle.title
            .key;
        actionName = workflowStages[i].actions[j].title.key;
        stageId =
          workflowStages[i].actions[j].eventLists[0].events[0].workflowStageId;
      }

      nextStages.push({ stageName, actionName, stageId });
    }

    // get branches data
    for (let p = 0; p < branchesLength; p++) {
      let branchName =
        workflowStages[i].parallelSets[p].parallelStages[0].title.key;
      branches.push({ branchName });
    }

    // check if the stage have multiple decision
    if (actionLength > 1 && workflowStages[i].stageType !== "Parallel") {
      hasDecision = true;
    }

    rectDataArray.push({
      currentStageId,
      currentStageName,
      nextStages,
      preStages,
      isEndStage,
      isApprovedStage,
      seqNo,
      stageType,
      hasDecision,
      branches,
      parallelSets
    });

  }

  // get prestage data only after 'nestStage' data is completed pushed to rectDataArray
  for (let i = 0; i < workflowStages.length; i++) {
    let currentStageId = rectDataArray[i].currentStageId;
    let preStageName;
    let preStageId;

    for (let j = 0; j < rectDataArray.length; j++) {
      for (let p = 0; p < rectDataArray[j].nextStages.length; p++) {
        if (rectDataArray[j].nextStages[p].stageId === currentStageId) {
          preStageId = rectDataArray[j].currentStageId;
          preStageName = rectDataArray[j].currentStageName;
          rectDataArray[i].preStages.push({ preStageName, preStageId });
        }
      }
    }
  }
}

// create control and use constructor function to trigger createElements() function
function createLayoutControl() {

  mainPaper = createPaper("myholder");
  mainPaper.on('link:pointerdown', (elementView, evt) => {
    console.log(elementView);
  });
  mainPaper.on('element:branchLabel:pointerdown', function (elementView, evt) {

    evt.stopPropagation(); // stop any further actions with the element view (e.g. dragging)
    var branch_id = evt.currentTarget.id;
    var labelId;
    var parallelSet;
    var branchStageName;

    for (const value of Object.values(elementView.selectors)) {
      if (branch_id === value.id) {
        labelId = value.getAttribute("joint-selector");
        parallelSet = elementView.model.attr(labelId).parallelSet;
        modalTitleLabel = elementView.model.attributes.currentStageName + " - " + elementView.model.attr(labelId).text;
      }
    }

    createModalStageData(parallelSet, branchStageName);
    modal.show();
  }),

    controls = new LayoutControls({
      el: document.getElementById("layoutControl"),
      paper: mainPaper,
      elementsArray: elements,
      linksArray: links,
      rectDataArray: rectDataArray
    });

  // to avoid rendering issue
  setTimeout(() => {
    controls.layout();
  }, 100);
}

function resetAll() {

  rectDataArray = [];
  elements = [];
  links = [];
  mainPaper = "";
  controls = "";
  totalWorkflows = 0;
  resetModal();

}





const generateButton = document.getElementById("fetchDataButton");
generateButton.addEventListener("click", () => {
  if (controls) {
    resetAll();
  }
  workflowNo = 1;
  callAPI(processJsonData);
});
generateButton.click();


const workflowNoButton = document.getElementById("workflowNo");
workflowNoButton.addEventListener("change", () => {
  const value = document.getElementById("workflowNo").value;

  if (controls) {
    resetAll();
  }
  // change the global workflowNo to desired workflow no
  workflowNo = value;
  callAPI();
});


const scaleDragger = document.getElementById("scale");
scaleDragger.addEventListener("change", () => {
  const value = $("#scale").val();
  mainPaper.scale(value);
});


