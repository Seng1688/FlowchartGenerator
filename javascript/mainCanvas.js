//** Global Variable **//
// destructuring assignment
const { shapes, util, dia, mvc } = joint;
const rectWidth = 140;
const rectHeight = 60;
let totalWorkflows;
let workflowNo = 1;
let mainPaper;
let mainGraph;
let rectDataArray = [];
let elements = [];
let links = [];
let cells = [];
let controls;
let branchCounter = 1; // to prevent 'json-dom-parser: selector must be unique' error
let dragStartPosition; // drag paper event
let message;





//** Definition **//
// extend mvc view and add custom control
var LayoutControls = mvc.View.extend({
  events: {
    change: "onChange",
    input: "onChange",
  },

  init: function () {
    var options = this.options;

    // add eventlinstener to the paper's elements
    this.listenTo(options.paper.model, "change", function (_, opt) {
    });
    setTimeout(() => {
      this.layout();
    }, 200);

  },

  onChange: function () {
    this.layout();
    this.trigger("layout");
  },

  layout: function () {

    let paper = this.options.paper;
    let graph = this.options.graph;
    let cells = this.options.cells;

    graph.resetCells(cells);

    // add link tools for each link
    addLinkTools(graph.getLinks(), paper);

    // build complete actions info's details for parallel stage
    buildParallelStageInfoButtonDetails();

    // add modal for each branch
    addBranchLabelModal(paper);

    paper.freeze();
    var graphBBox = joint.layout.DirectedGraph.layout(graph, this.getLayoutOptions());

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

// custom  shape
var ParallelRect = dia.Element.define(
  "custom.ParallelRectangle",
  {
    attrs: {
      header: {
        width: "calc(w)",
        height: "calc(h -calc(h -24))", //always make header height 24
        strokeWidth: 1.5,
        stroke: "black",
        fill: "yellow",
      },
      body: {
        width: "calc(w)",
        height: "calc(h)",
        strokeWidth: 1.5,
        stroke: "black",
        x: 0,
        y: 0,
        fill: "lightyellow",
      },
      icon: {
        width: 16,
        height: 16,
        x: "calc(w-18)",
        y: 4,
        'xlink:href': 'picture/info_icon.png'
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
        tagName: "image",
        selector: "icon",
      },
      {
        tagName: "text",
        selector: "titleLabel",
      },
    ],
  }
);

class InitialNode extends joint.dia.Element {
  constructor(attributes) {
    super({
      markup: [
        {
          tagName: 'circle',
          selector: 'body',
        },
        {
          tagName: 'text',
          selector: 'label',
        },
      ],
      type: 'custom.InitialNode',
      size: { width: 30, height: 30 },
      attrs: {
        body: {
          fill: '#333',
          stroke: 'black',
          strokeWidth: 2,
          cx: "calc(0.5 * w)",
          cy: "calc(0.5 * h)",
          r: "calc(0.5 * w)",
        },
        label: {
          fill: 'white',
          fontSize: 12,
          refX: '50%', // Center the label horizontally
          refY: '50%', // Center the label vertically
        },
      },
      ...attributes,
    });
  }
}

class EndNode extends joint.dia.Element {
  constructor(attributes) {
    super({
      markup: [
        {
          tagName: 'circle',
          selector: 'body',
        },
        {
          tagName: 'circle',
          selector: 'innerCircle',
        },
      ],
      type: 'custom.EndNode',
      size: { width: 30, height: 30 },
      attrs: {
        body: {
          fill: 'transparent',
          stroke: '#333',
          strokeWidth: 2,
          cx: 'calc(0.5 * w)', // Center the circle horizontally
          cy: 'calc(0.5 * h)', // Center the circle vertically
          r: 'calc(0.5 * w)', // Radius is half of the width
        },
        innerCircle: {
          fill: '#333',
          stroke: null,
          cx: 'calc(0.5 * w)', // Center the circle horizontally
          cy: 'calc(0.5 * h)', // Center the circle vertically
          r: 'calc(0.33 * w)', // Radius is one-third of the width
        },
      },
      ...attributes,
    });
  }
}

class Decision extends joint.dia.Element {
  constructor(attributes) {
    super({
      markup: [
        {
          tagName: 'path',
          selector: 'body',
        },
      ],
      type: 'custom.Decision',
      size: { width: 40, height: 40 },
      position: { x: 100, y: 100 }, // Set the initial position of the element
      attrs: {
        body: {
          fill: 'white',
          stroke: 'black',
          strokeWidth: 2,
          d: 'M 20 0 L 40 20 L 20 40 L 0 20 z',
        },
      },
      ...attributes,
    });
  }
}




//** Graph Elements Creation Function **//
function createPaper(holderId) {
  let paper = new dia.Paper({
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
    linkPinning: true,
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

  paper.on('blank:pointerdown',
    function (event, x, y) {
      var scale = paper.scale();
      paper.dragStartPosition = { x: x * scale.sx, y: y * scale.sy };

    }
  );

  paper.on('blank:pointerup', function () {
    console.log('a');
    paper.dragStartPosition = false;
  });

  paper.on('cell:pointerup', function () {
    autoResizePaper(paper);
  });



  $(`#${holderId}`).mousemove(function (event) {
    if (paper.dragStartPosition) {
      paper.translate(
        event.offsetX - paper.dragStartPosition.x,
        event.offsetY - paper.dragStartPosition.y);
    }

  });


  return paper;
}

function createStartNode(elementsArray) {
  const startNode = new InitialNode({
    id: "startNode",
    name: "startNode",
    // isLocked: true,
  });

  elementsArray.push(startNode);
}

function createEndNode(elementsArray) {
  const endNode = new EndNode({
    id: "endNode",
    // isLocked: true,
  });
  elementsArray.push(endNode);
}

// dataArray - an array that contains rectData that will be wrapped with a rectangle
// elementsArray - an array to store the generated rectangle model
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

  let fullStageName = rectData.currentStageName;
  let processedStageName = checkAndAddEllipsis(fullStageName, 20);

  const Rect = new shapes.standard.Rectangle({
    id: rectData.currentStageId.toString(),
    size: { width: rectWidth, height: rectHeight },

    attrs: {
      body: {
        fill: fillValue,
        stroke: "black",
        strokeWidth: 1.5,
      },

      label: {
        text: processedStageName,
        title: fullStageName,
        fill: "black"
      },
    },
    seqNo: rectData.seqNo,
  });
  return Rect;
}

function createParallelRect(rectData) {


  let fullStageName = rectData.currentStageName;
  let processedStageName = checkAndAddEllipsis(fullStageName, (rectData.branches.length > 3) ? 30 : rectData.branches.length * 12);

  var parallel = new ParallelRect({
    id: rectData.currentStageId.toString(),
    currentStageName: rectData.currentStageName,
    size: { width: 100, height: 80 },
    attrs: {
      titleLabel: {
        text: processedStageName,
      },
      header: {
        title: fullStageName,
      }

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

    let fullBranchName = rectData.branches[i].branchName;
    let processedBranchName = checkAndAddEllipsis(fullBranchName, 10);

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
      text: processedBranchName,
      title: fullBranchName,
      refX: "50%",
      refY: "50%",
      parallelSet: parallelSet,
      class: "branchLabel",
    });
    parallel.markup.push(branchLabelMarkup);

    branchCounter++;
    counter++;
  }

  parallel.attr("icon", {
    id: rectData.currentStageId,
  });

  return parallel;
}

function createDecisionPolygon(dataArray, elementsArray) {
  dataArray.forEach((rectData) => {
    let childSize = rectData.nextStages.length;
    let parentId = rectData.currentStageId;
    let seqNo = rectData.seqNo;

    if (childSize > 1) {
      const decisionPolygon = new Decision({
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
          class: "textLabel",
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
          class: "textLabelBody"
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
      name: "jumpover",
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


    let fullActionName = actionLabel;
    let processedActionLabel = checkAndAddEllipsis(fullActionName, 15);

    link.labels([
      {
        attrs: {
          labelText: {
            text: processedActionLabel,
            title: fullActionName,
            z: 9,
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
function createCells(elementsArray, linksArray, rectDataArray) {
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
      createLink(linksArray, source, "endNode", { sourceSide: "perpendicular" }, { targetSide: "center" });
    }

  });

  //  =========================================Concatenate all elements========================================
  cells = elementsArray.concat(linksArray);
  return cells;
}

// create control for graph
function createLayoutControl(controlDivId, paper, graph, cells) {

  controls = new LayoutControls({
    el: document.getElementById(`${controlDivId}`),
    paper: paper,
    graph: graph,
    cells: cells,
    rectDataArray: rectDataArray,
    padding: 50,
  });

}





//** Other Function **//
function addLinkTools(links, paper) {
  links.forEach(link => {
    let linkView = paper.findViewByModel(link);
    linkView.addTools(createLinkTools());
    linkView.hideTools();
  });

  paper.on("link:mouseover", (linkView) => {
    linkView.showTools();
  })

  paper.on("link:mouseout", (linkView) => {
    linkView.hideTools();
  })

}

function createLinkTools() {

  // var InfoButton = joint.linkTools.Button.extend({
  //   name: 'info-button',
  //   options: {
  //     focusOpacity: 0.5,
  //     distance: 60,
  //     action: function (evt) {
  //       alert('View id: ' + this.id + '\n' + 'Model id: ' + this.model.id);
  //     },
  //     markup: [{
  //       tagName: 'circle',
  //       selector: 'button',
  //       attributes: {
  //         'r': 7,
  //         'fill': '#001DFF',
  //         'cursor': 'pointer'
  //       }
  //     }, {
  //       tagName: 'path',
  //       selector: 'icon',
  //       attributes: {
  //         'd': 'M -2 4 2 4 M 0 3 0 0 M -2 -1 1 -1 M -1 -4 1 -4',
  //         'fill': 'none',
  //         'stroke': '#FFFFFF',
  //         'stroke-width': 2,
  //         'pointer-events': 'none'
  //       }
  //     }]
  //   }
  // });

  // var infoButton = new InfoButton();

  // var segmentsTool = new joint.linkTools.Segments();

  // var removeButton = new joint.linkTools.Remove({
  //   focusOpacity: 0.2,
  //   rotate: true,
  //   distance: -20,
  //   offset: 0
  // });

  // var sourceAnchorTool = new joint.linkTools.SourceAnchor({
  //   focusOpacity: 0.5,
  //   redundancyRemoval: false,
  //   restrictArea: false,
  //   snapRadius: 20
  // });

  // var targetAnchorTool = new joint.linkTools.TargetAnchor({
  //   focusOpacity: 0.5,
  //   redundancyRemoval: false,
  //   restrictArea: false,
  //   snapRadius: 20
  // });

  // const connectButton = new joint.linkTools.Connect({
  //   rotate: true,
  //   distance: -20,
  //   offset: 20,
  //   magnet: 'body'
  // });

  var sourceArrowheadTool = new joint.linkTools.SourceArrowhead({
    focusOpacity: 0.5
  });

  var verticesTool = new joint.linkTools.Vertices({
    focusOpacity: 0.5,
    redundancyRemoval: true,
    snapRadius: 10,
    vertexAdding: true,
  });

  var targetArrowheadTool = new joint.linkTools.TargetArrowhead({
    focusOpacity: 1,
    scale: 1,
  });

  var boundaryTool = new joint.linkTools.Boundary({
    focusOpacity: 0.5,
    padding: 10,
    useModelGeometry: false
  });

  var toolsView = new joint.dia.ToolsView({
    name: 'link-tools',
    tools: [verticesTool, boundaryTool, targetArrowheadTool, sourceArrowheadTool]
  });

  return toolsView;
}

function createImage(w, h, imagePath, imageLabel) {
  var image = new joint.shapes.standard.Image({
    size: { width: w, height: h },
    attrs: {
      label: { text: imageLabel },
      image: { 'xlink:href': imagePath }
    }
  });
  return image

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

function checkAndAddEllipsis(text, maxLength) {
  if (text !== '') {
    if (text.length > 20) {
      var string = text.substring(0, maxLength) + "...";
      return string;
    }
    else {
      return text;
    }
  }

}

function insertLoading() {
  const holder = document.getElementById("mainPaper");
  // insert loading icon
  holder.innerHTML = `<div> <img id="loading-icon" style=" width:280px; height:300px;top:180px" src="picture/loading.gif"> </div>`
  const loadingIcon = document.getElementById("loading-icon");
  loadingIconWidth = parseInt(loadingIcon.style.width, 10);
  let centerX;

  if (holder.style.width) {
    centerX = parseInt(holder.style.width, 10) / 2 - (loadingIconWidth / 2);
  }
  else {
    centerX = holder.parentElement.clientWidth / 2 - (loadingIconWidth / 2) + (0.26 * holder.parentElement.clientWidth);
    loadingIcon.style.top = (parseInt(loadingIcon.style.top, 10) + 230) + 'px';
  }

  loadingIcon.style.left = centerX + 'px';
}

function insertErrorMessage(divHolder, message) {
  let errorMessage = `<span class="fs-3">${message}</span>`;
  divHolder.innerHTML = errorMessage;
}

function autoResizePaper(paper) {
  paper.fitToContent({
    padding: 50,
    allowNewOrigin: "any",
    useModelGeometry: true,
  });
}




// parallel stage related
function buildParallelStageInfoButtonDetails() {
  const parallelRects = document.querySelectorAll('[data-type="custom.ParallelRectangle"]');
  const parallelButtons = document.querySelectorAll('[data-type="custom.ParallelRectangle"] image[joint-selector="icon"]');
  let size = parallelRects.length;

  for (let i = 0; i < size; i++) {
    let stageId = parallelButtons[i].id;

    parallelButtons[i].addEventListener('click', (evt) => {

      var divBlock = document.querySelector(".CompleteActionsDetailsBody");
      let paragraph = getParallelStageCompleteActionsDetails(stageId);

      if (!divBlock) {
        divBlock = document.createElement("div");
        divBlock.classList.add('CompleteActionsDetailsBody');
        divBlock.style.top = (evt.y) + "px";
        divBlock.style.left = (evt.x) + "px";
        divBlock.style.opacity = 0;
        divBlock.appendChild(paragraph);
        document.body.appendChild(divBlock); // This appends the div to the body element
        setTimeout(() => {
          divBlock.style.opacity = 1;
        }, 100);

        // remove the div block when it is clicked
        divBlock.addEventListener('click', (evt) => {

          var divBlock = document.querySelector(".CompleteActionsDetailsBody");

          if (divBlock) {
            divBlock.style.opacity = 0;
            setTimeout(() => {
              document.body.removeChild(divBlock);
            }, 400);
          }

        });
      }

    })

  }
}

function getParallelStageCompleteActionsDetails(stageId) {

  // simplify action details
  let parallelCompletesActions = [];

  let index = rectDataArray.findIndex((rect) => {
    return rect.currentStageId.toString() === stageId.toString();
  })

  if (index) {
    let parallelCompletes = rectDataArray[index].parallelCompletes;

    for (let i = 0; i < parallelCompletes.length; i++) {
      const details = {
        title: parallelCompletes[i].title.key,
        stageGroups: parallelCompletes[i].stageGroups
      }
      parallelCompletesActions.push(details);
    }

  }

  //create text based on action details 
  let html = ``;
  let paragraph = document.createElement("p");

  for (let i = 0; i < parallelCompletesActions.length; i++) {
    let pcAction = parallelCompletesActions[i];
    html += `<span class="bold underline">${i + 1}) Complete Action:<span class="red"> ${pcAction.title} </span> </span><br>`

    for (let j = 0; j < pcAction.stageGroups.length; j++) {
      let stageGroup = pcAction.stageGroups[j];
      html += `<span class="bold"> Stage Group: ${j + 1} </span><br>`
      html += `<span class="green bold">${stageGroup.operator}</span> of these condition(s) must be fullfilled </span><br>`

      for (let p = 0; p < stageGroup.stages.length; p++) {
        let stages = stageGroup.stages[p];
        let actionName = stages.actionName.key;
        if (actionName === "") {
          actionName = "Any/No Action"
        }

        html += ` When <span class="blue bold"> ${stages.stageName.key}</span> is  <span class="blue bold"> ${actionName}</span> <br>  `

      }

      if (j < pcAction.stageGroups.length - 1) {
        html += `<span class="bold">AND </span><br>`
      }

    }
    html += `<br>`;
  }

  paragraph.innerHTML = html;
  return paragraph;
}

function resetAll() {

  $(".ranksep").val(75);
  $(".edgesep").val(100);
  $(".nodesep").val(75);
  $("#scale").val(0.8);

  rectDataArray = [];
  elements = [];
  links = [];
  mainPaper = "";
  controls = "";
  totalWorkflows = 0;
  resetModal();

}

function addBranchLabelModal(paper) {
  paper.on('element:branchLabel:pointerdown', function (elementView, evt) {

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
  })
}



//** Data Process Function **//
// get raw JSON Data
function callAPI() {
  const formId = document.getElementById("formId").value;
  const holder = document.getElementById("mainPaper");

  if (formId !== '') {
    // API endpoint URL
    const apiUrl = "https://qa1.kube365.com/api/workflows/" + formId; // Replace with your API URL

    // Bearer token (replace 'YOUR_TOKEN' with your actual token)
    const authToken = "eyJhbGciOiJSUzI1NiIsImtpZCI6IkYzNkI2NDUzQUQ1OEQwQTM0MTRBOTgxMDhGOEE3NkNBIiwidHlwIjoiYXQrand0In0.eyJuYmYiOjE2OTk1ODIzOTUsImV4cCI6MTY5OTU4NTk5NSwiaXNzIjoiaHR0cHM6Ly9xYWxvZ2luLmt1YmUzNjUuY29tIiwiYXVkIjpbIkt1YmUuMzY1LkFwaSIsIkt1YmUuMzY1LkFkbWluLkFwaSJdLCJjbGllbnRfaWQiOiJLdWJlLjM2NS43ZWU3YzE0OC1jMTQ0LTQ2ZWMtYmNhOS1iNzczYWZiYzZmNDUuVUkiLCJzdWIiOiJ5b25nc2VuZy5jaGlhQGlzYXRlYy5jb20iLCJhdXRoX3RpbWUiOjE2OTk1Nzg3NTEsImlkcCI6IkZvcm1zIiwianRpIjoiMjlBOEFGODg2MjgyMzlGRkVGNzFCRjNCMjhCQUM3RkEiLCJzaWQiOiJFNDQ1QTQzM0U2OEUyQjUwMTNCM0UwRTQ1NjcwRjE5OCIsImlhdCI6MTY5OTU3ODc1NSwic2NvcGUiOlsib3BlbmlkIiwicHJvZmlsZSIsImt1YmUuMzY1LnNjb3BlIiwib2ZmbGluZV9hY2Nlc3MiXSwiYW1yIjpbImV4dGVybmFsIl19.DNRYn4-ju-vOBK4KM4QOHi7WWxktlJ_2Q_rmPFv-vbaIpK6CnNX7z4VZgMmyc_Nhv6UAFEoYTbM9mRnrld8XQdMwQ1ic6svLm1qtKfC603jGCR08pqjCW9gFrMm4S5V7UbLguxKgNmazDmySGPi7Jy75L6jD7yebm1C-XVHzyYZNzxLJZatTIGkalPRZ50qrvkzdp-W2lpm1shr74w0YUdoL4XAw2iKFzPh_ZBE_i3dltZYToLDWjRVeDV-5FM2u02KZW0aeMyMTJAq7toW4yblc6SrzybHHOv4INZ-IGGASRmPrsCzKuEaCKpLeZEw-gNfwWZ-_ZovPfRETbjnmZQ"

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
        processJsonData(data);
      })
      .catch((error) => {
        if (error.message.includes("401")) {
          message = error.message + `!! 😊 You do not have the necessary <b>permissions</b> to access this resource. `;
          insertErrorMessage(holder, message);
        }
        else {
          message = `No Workflows is found on <b>Form ID: ${formId} 😊!!</b> `;
          insertErrorMessage(holder, message);
        }
      });
  }
  else {
    message = `Please Input a <b>Form ID</b>😊!!`;
    insertErrorMessage(holder, message);
  }

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
      parallelCompletes: w.parallelCompletes,
    };
  });

  createDropdownList();
  createStagesData(workflowStages); // output is rectDataArray
  init();

}

// create workflow dropdown list based on number of workflows
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
    let parallelCompletes = workflowStages[i].parallelCompletes;

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
      parallelSets,
      parallelCompletes
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

function init() {
  mainPaper = createPaper("mainPaper");
  mainGraph = mainPaper.model;
  cells = createCells(elements, links, rectDataArray);
  createLayoutControl('layoutControl', mainPaper, mainGraph, cells);
}





const workflowNoButton = document.getElementById("workflowNo");
workflowNoButton.addEventListener("change", () => {
  const value = document.getElementById("workflowNo").value;
  insertLoading();
  if (controls) {
    resetAll();
  }
  // change the global workflowNo to desired workflow no
  workflowNo = value;
  callAPI();
});

const scaleDragger = document.getElementById("scale");
scaleDragger.addEventListener("input", () => {
  const value = $("#scale").val();
  mainPaper.scale(value);
});

const generateButton = document.getElementById("fetchDataButton");
generateButton.addEventListener("click", () => {

  insertLoading();

  if (controls) {
    resetAll();
  }
  workflowNo = 1;
  callAPI();
});
generateButton.click();

const exportButton = document.getElementById("exportButton");
exportButton.addEventListener("click", () => {
  let string = JSON.stringify(mainGraph.toJSON());
  var blob = new Blob([string], {
    type: "text/plain;charset=utf-8",
  });

  // Create and save the file using the FileWriter library
  saveAs(blob, 'fileName');
});

const importButton = document.getElementById("inputfile");
importButton.addEventListener("change", () => {

  let fileContent = '';
  var fr = new FileReader();
  fr.onload = function () {
    fileContent = fr.result;

    mainGraph.fromJSON(JSON.parse(fileContent));
    links = mainGraph.getLinks();
    elements = mainGraph.getElements();
    cells = mainGraph.getCells();
    addLinkTools(links, mainPaper);
    buildParallelStageInfoButtonDetails();
    autoResizePaper(mainPaper);
  }
  fr.readAsText(document.getElementById('inputfile').files[0]);



});

const saveButton = document.getElementById("saveButton");
saveButton.addEventListener("click", () => {
  $('.alert').css('opacity', 1);
  $('.alert').css('top', '5%');

  setTimeout(() => {
    $('.alert').css('opacity', 0);
    $('.alert').css('top', '-50%');
  }, 2500);

  //disable all the available controls
  let selectControls = $("#layoutControl input, #layoutControl select");
  selectControls.each(function (index, element) {
    $(element).prop("disabled", true);
  });

  ;
});

