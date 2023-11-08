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
    options.cells = createElements(options.elementsArray, options.linksArray, options.rectDataArray);

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
    let graph = paper.model;
    let cells = this.options.cells;
    mainGraph = graph;
    graph.resetCells(cells);

    // add link tools for each link
    addLinkTools(cells, paper);

    // build complete actions info's details for parallel stage
    buildParallelStageInfoButtonDetails();

    // add modal for each branch
    addBranchLabelModal(paper);

    paper.freeze();
    joint.layout.DirectedGraph.layout(graph, this.getLayoutOptions());

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
      type:'custom.InitialNode',
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
          fill:'white',
          stroke:'black',
          strokeWidth: 2,
          d: 'M 20 0 L 40 20 L 20 40 L 0 20 z',
        },
      },
      ...attributes,
    });
  }
}


const cellNamespace = {};





//** Graph Elements Creation Function **//
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
      createLink(linksArray, source, "endNode", { sourceSide: "perpendicular" }, { targetSide: "center" });
    }

  });

  //  =========================================Concatenate all elements========================================

  return elementsArray.concat(linksArray);
}





//** Other Function **//
function addLinkTools(cells, paper) {
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
  const holder = document.getElementById("myholder");
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
  const holder = document.getElementById("myholder");

  if (formId !== '') {
    // API endpoint URL
    const apiUrl = "https://qa1.kube365.com/api/workflows/" + formId; // Replace with your API URL

    // Bearer token (replace 'YOUR_TOKEN' with your actual token)
    const authToken =
      "eyJhbGciOiJSUzI1NiIsImtpZCI6IkYzNkI2NDUzQUQ1OEQwQTM0MTRBOTgxMDhGOEE3NkNBIiwidHlwIjoiYXQrand0In0.eyJuYmYiOjE2OTk0MjUyNjQsImV4cCI6MTY5OTQyODg2NCwiaXNzIjoiaHR0cHM6Ly9xYWxvZ2luLmt1YmUzNjUuY29tIiwiYXVkIjpbIkt1YmUuMzY1LkFwaSIsIkt1YmUuMzY1LkFkbWluLkFwaSJdLCJjbGllbnRfaWQiOiJLdWJlLjM2NS43ZWU3YzE0OC1jMTQ0LTQ2ZWMtYmNhOS1iNzczYWZiYzZmNDUuVUkiLCJzdWIiOiJ5b25nc2VuZy5jaGlhQGlzYXRlYy5jb20iLCJhdXRoX3RpbWUiOjE2OTk0MjUyNjEsImlkcCI6IkZvcm1zIiwianRpIjoiODM2Rjg5OTVDQzNDOTBENjA0NzQ3QjAzRjJCM0Y3REYiLCJzaWQiOiJFQTY2NTYzRkU4RTMzMUMzRURCMzg3OTVBNEMwRjA4MCIsImlhdCI6MTY5OTQyNTI2NCwic2NvcGUiOlsib3BlbmlkIiwicHJvZmlsZSIsImt1YmUuMzY1LnNjb3BlIiwib2ZmbGluZV9hY2Nlc3MiXSwiYW1yIjpbImV4dGVybmFsIl19.kZWY05IQ5FgHvJDOLKUQ-3uwyKHd-mjn8bIBW_8fQYKoC-ovb2UFGkwAC3kPezJ5ipRukVn5rNlIhORML1pH-uFb6EU_fkCrqU_c8l_W3F6CzMj8hd2TDKjCpzjxRPCDyaNmtqsCjKkuXpDAnC8KstYCXdhT2vKN9bjwtiuLjHcWTr28MDCTYTMhhyHT-yQA-pcGFxEKyyX3Aq-Zf59Q6JhB3v-ohOObOIXdainxRwtFUwyCbhI0dbcbrqXDpFVlMGXeyfSi7f3qbpo-zHvgfvGFzAXgmhoMxxGf_C8FqkBsksKPoXq0t3Pz7C2DQT9js6eQyv_6xB-UFX6haoLfqg"

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
  createStagesData(workflowStages);
  createLayoutControl();
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

// create control and use constructor function to trigger createElements() function
function createLayoutControl() {

  mainPaper = createPaper("myholder");

  mainPaper.on('blank:pointerdown',
    function (event, x, y) {
      var scale = mainPaper.scale();
      mainPaper.dragStartPosition = { x: x * scale.sx, y: y * scale.sy };
    }
  );

  mainPaper.on('blank:pointerup', function () {
    mainPaper.dragStartPosition = false;
  });

  $("#myholder").mousemove(function (event) {
    if (mainPaper.dragStartPosition) {
      mainPaper.translate(
        event.offsetX - mainPaper.dragStartPosition.x,
        event.offsetY - mainPaper.dragStartPosition.y);
    }

  });

  controls = new LayoutControls({
    el: document.getElementById("layoutControl"),
    paper: mainPaper,
    elementsArray: elements,
    linksArray: links,
    rectDataArray: rectDataArray,
    padding: 50,
    cellViewNamespace: cellNamespace
  });

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












// const exportButton = document.getElementById("exportButton");
// exportButton.addEventListener("click", () => {
//   mainGraph.set('graphCustomProperty', true);
//   mainGraph.set('graphExportTime', Date.now());
//   var jsonObject = mainGraph.toJSON();

//   var graph2 = new joint.dia.Graph();
//   graph2.fromJSON(jsonObject);
//   graph2.get('graphCustomProperty'); // true
//   graph2.get('graphExportTime');
//   var paper2 = createPaper("myholder2", graph2);

// });

// const importButton = document.getElementById("importButton");
// importButton.addEventListener("click", () => {

//   graph2.fromJSON(graphObject());
// });

const downloadButton = document.getElementById("downloadButton");
downloadButton.addEventListener("click", () => {
  let string = JSON.stringify(mainGraph.toJSON());
  var blob = new Blob([string], {
    type: "text/plain;charset=utf-8",
  });

  // Create and save the file using the FileWriter library
  saveAs(blob, 'fileName');

});

setTimeout(() => {
  mainGraph.fromJSON(graphObject());
}, 2000);

function graphObject() {
 let obj = {"cells":[{"position":{"x":130,"y":0},"size":{"width":30,"height":30},"angle":0,"markup":[{"tagName":"circle","selector":"body"},{"tagName":"text","selector":"label"}],"type":"custom.InitialNode","id":"startNode","name":"startNode","attrs":{"body":{"fill":"#333","stroke":"black","strokeWidth":2,"cx":"calc(0.5 * w)","cy":"calc(0.5 * h)","r":"calc(0.5 * w)"},"label":{"fill":"white","fontSize":12,"refX":"50%","refY":"50%"}}},{"position":{"x":130,"y":1112},"size":{"width":30,"height":30},"angle":0,"markup":[{"tagName":"circle","selector":"body"},{"tagName":"circle","selector":"innerCircle"}],"type":"custom.EndNode","id":"endNode","attrs":{"body":{"fill":"transparent","stroke":"#333","strokeWidth":2,"cx":"calc(0.5 * w)","cy":"calc(0.5 * h)","r":"calc(0.5 * w)"},"innerCircle":{"fill":"#333","stroke":null,"cx":"calc(0.5 * w)","cy":"calc(0.5 * h)","r":"calc(0.33 * w)"}}},{"type":"standard.Rectangle","position":{"x":75,"y":140},"size":{"width":140,"height":60},"angle":0,"id":"46270","seqNo":1,"attrs":{"body":{"strokeWidth":1.5,"stroke":"black","fill":"rgb(49, 197, 255)"},"label":{"fill":"black","text":"F1Stage0StageName","title":"F1Stage0StageName"}}},{"type":"custom.ParallelRectangle","position":{"x":720,"y":150},"size":{"width":290,"height":182},"angle":0,"id":"48186","currentStageName":"F1Stage1StageName","attrs":{"header":{"title":"F1Stage1StageName"},"icon":{"id":48186},"titleLabel":{"text":"F1Stage1StageName"},"branch1":{"ref":"body","width":90,"height":46,"refX":5,"refY":29,"strokeWidth":1,"stroke":"black","fill":"white"},"branch1_label":{"ref":"branch1","cursor":"pointer","event":"element:branchLabel:pointerdown","textAnchor":"middle","textVerticalAnchor":"middle","text":"branchName","title":"branchName","refX":"50%","refY":"50%","parallelSet":{"parallelSet":1,"startingConditions":[{"workflowStageParallelId":0,"workflowStageId":48186,"startingCondition":"start","startingConditionSetting":{"fields":[]},"startingStages":[{"title":"{\"key\":\"branchName\",\"type\":\"custom\",\"values\":[{\"language\":\"en-US\",\"value\":\"branchName\"},{\"language\":\"zh-Hans\",\"value\":\"分支1\"},{\"language\":\"id-ID\",\"value\":\"Cabang1\"},{\"language\":\"ms-MY\",\"value\":\"Cawangan1\"},{\"language\":\"zh-Hant\",\"value\":\"分支1\"},{\"language\":\"th-TH\",\"value\":\"สาขา1\"}]}","workflowStageId":48187}]}],"parallelStages":[{"parallelSet":1,"workflowId":1072,"workflowVersionId":4205,"workflowStageId":48187,"workflowStageCode":"F1Stage1StageName_Branch1","title":{"key":"branchName","type":"custom","values":[{"language":"en-US","value":"branchName"},{"language":"zh-Hans","value":"分支1"},{"language":"id-ID","value":"Cabang1"},{"language":"ms-MY","value":"Cawangan1"},{"language":"zh-Hant","value":"分支1"},{"language":"th-TH","value":"สาขา1"}]},"displayName":{"key":"pendingbranch1","type":"custom","values":[{"language":"en-US","value":"Pending Branch 1"},{"language":"zh-Hans","value":"待定分支1"},{"language":"id-ID","value":"Cabang Tertunda 1"},{"language":"ms-MY","value":"Cawangan Tertunda 1"},{"language":"zh-Hant","value":"待定分支1"},{"language":"th-TH","value":"รอดำเนินการสาขา1"}]},"stageType":"Standard","seqNo":1,"isEndStage":false,"isApprovedStage":false,"isSLA":false,"isPublished":true,"stageConfig":{"stageTypeConfigs":[],"isAllowDelegation":false,"isAllowDelegationToGroup":false,"isAllowRequestorAssignUser":false,"hasStageReview":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"noAssigneeActionEvents":[],"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"sameApproverActionEvents":[],"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOption":"OneAssignee","assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false}},"notificationCount":0,"reminderCount":0,"integrationCount":0,"deleteLock":true,"requestorSubLock":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"noAssigneeActionEvents":[],"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"sameApproverActionEvents":[],"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOption":"OneAssignee","assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false},"assignedTos":[],"readers":[],"workflowStageTriggers":[],"workflowStageSLA":{"slaDuration":0,"slaThreshold":0,"workingDays":[],"workingHoursPerDay":0},"actions":[{"workflowActionId":55877,"workflowActionCode":"c43b35c0-ccf8-437c-9f72-fe3b28b6dc38","actionType":"standard","options":{"buttonName":{"key":"Approve","type":"custom","values":[{"language":"en-US","value":"Approve"},{"language":"zh-Hans","value":"核准"},{"language":"id-ID","value":"Menyetujui"},{"language":"ms-MY","value":"Lulus"},{"language":"zh-Hant","value":"核准"},{"language":"th-TH","value":"อนุมัติ"}]},"buttonColor":"btn-primary","sequence":"1","seqNo":0,"conditionalActionEvent":false,"systemAction":true,"condition":{"conditionGroups":[]},"allowFieldValidation":false,"fieldValidationGroups":[],"workflowActionId":0},"deleteLock":true,"eventLists":[{"ruleName":"Rule 1","assignOption":"OneAssignee","events":[{"eventType":"GotoStage","workflowStageId":48188,"stageTitle":{"workflowStageId":48188,"title":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]}},"config":{}}]}],"notificationCount":0,"title":{"key":"Approve","type":"custom","values":[{"language":"en-US","value":"Approve"},{"language":"zh-Hans","value":"核准"},{"language":"id-ID","value":"Menyetujui"},{"language":"ms-MY","value":"Lulus"},{"language":"zh-Hant","value":"核准"},{"language":"th-TH","value":"อนุมัติ"}]}},{"workflowActionId":55921,"workflowActionCode":"3c433d63-cd26-4d12-ad35-de4f40ac1c1f","actionType":"standard","options":{"buttonName":{"key":"Reject","type":"custom","values":[{"language":"en-US","value":"Reject"},{"language":"zh-Hans","value":""},{"language":"id-ID","value":""},{"language":"ms-MY","value":""},{"language":"zh-Hant","value":""},{"language":"th-TH","value":""}]},"buttonColor":"btn-lightgrey","seqNo":0,"conditionalActionEvent":false,"systemAction":false,"condition":{"conditionGroups":[]},"allowFieldValidation":false,"fieldValidationGroups":[],"workflowActionId":0},"deleteLock":false,"eventLists":[{"ruleName":"Rule 1","assignOption":"OneAssignee","events":[{"eventType":"GotoStage","workflowStageId":48239,"stageTitle":{"workflowStageId":48239,"title":{"key":"Reject","type":"custom","values":[{"language":"en-US","value":"Reject"},{"language":"zh-Hans","value":""},{"language":"id-ID","value":""},{"language":"ms-MY","value":""},{"language":"zh-Hant","value":""},{"language":"th-TH","value":""}]}},"config":{}}]}],"notificationCount":0,"title":{"key":"Reject","type":"custom","values":[{"language":"en-US","value":"Reject"},{"language":"zh-Hans","value":""},{"language":"id-ID","value":""},{"language":"ms-MY","value":""},{"language":"zh-Hant","value":""},{"language":"th-TH","value":""}]}}],"parallelWorkflowStageId":48186,"parallelDeleteLock":false,"hasNoStageNotifToAssignee":true},{"parallelSet":1,"workflowId":1072,"workflowVersionId":4205,"workflowStageId":48188,"workflowStageCode":"F1Stage1StageName_BranchApproved1","title":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]},"displayName":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]},"stageType":"Standard","seqNo":2,"isEndStage":true,"isApprovedStage":true,"isSLA":false,"isPublished":true,"stageConfig":{"stageTypeConfigs":[],"isAllowDelegation":false,"isAllowDelegationToGroup":false,"isAllowRequestorAssignUser":false,"hasStageReview":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false}},"notificationCount":0,"reminderCount":0,"integrationCount":0,"deleteLock":true,"requestorSubLock":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false},"assignedTos":[],"readers":[],"workflowStageTriggers":[],"actions":[],"parallelWorkflowStageId":48186,"parallelDeleteLock":false,"hasNoStageNotifToAssignee":true},{"parallelSet":1,"workflowId":1072,"workflowVersionId":4205,"workflowStageId":48239,"workflowStageCode":"RejectStageCode","title":{"key":"Reject","type":"custom","values":[{"language":"en-US","value":"Reject"},{"language":"zh-Hans","value":""},{"language":"id-ID","value":""},{"language":"ms-MY","value":""},{"language":"zh-Hant","value":""},{"language":"th-TH","value":""}]},"displayName":{"key":"RejectDN","type":"custom","values":[{"language":"en-US","value":"RejectDN"},{"language":"zh-Hans","value":""},{"language":"id-ID","value":""},{"language":"ms-MY","value":""},{"language":"zh-Hant","value":""},{"language":"th-TH","value":""}]},"stageType":"Standard","seqNo":3,"isEndStage":true,"isApprovedStage":false,"isSLA":false,"stageConfig":{"stageTypeConfigs":[],"isAllowDelegation":false,"isAllowDelegationToGroup":false,"isAllowRequestorAssignUser":false,"hasStageReview":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"noAssigneeActionEvents":[],"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"sameApproverActionEvents":[],"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOption":"OneAssignee","assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false}},"notificationCount":0,"reminderCount":0,"integrationCount":0,"deleteLock":false,"requestorSubLock":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"noAssigneeActionEvents":[],"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"sameApproverActionEvents":[],"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOption":"OneAssignee","assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false},"assignedTos":[],"readers":[],"workflowStageTriggers":[],"workflowStageSLA":{"slaDuration":0,"slaThreshold":0,"workingDays":[],"workingHoursPerDay":0},"actions":[],"parallelWorkflowStageId":48186,"parallelDeleteLock":false,"hasNoStageNotifToAssignee":true}]},"class":"branchLabel"},"branch2":{"ref":"body","width":90,"height":46,"refX":100,"refY":29,"strokeWidth":1,"stroke":"black","fill":"white"},"branch2_label":{"ref":"branch2","cursor":"pointer","event":"element:branchLabel:pointerdown","textAnchor":"middle","textVerticalAnchor":"middle","text":"branch2","title":"branch2","refX":"50%","refY":"50%","parallelSet":{"parallelSet":2,"startingConditions":[{"workflowStageParallelId":0,"workflowStageId":48186,"startingCondition":"start","startingConditionSetting":{"fields":[]},"startingStages":[{"title":"{\"key\":\"branch2\",\"type\":\"custom\",\"values\":[{\"language\":\"en-US\",\"value\":\"Branch2\"},{\"language\":\"zh-Hans\",\"value\":\"分支2\"},{\"language\":\"id-ID\",\"value\":\"Cabang2\"},{\"language\":\"ms-MY\",\"value\":\"Cawangan2\"},{\"language\":\"zh-Hant\",\"value\":\"分支2\"},{\"language\":\"th-TH\",\"value\":\"สาขา2\"}]}","workflowStageId":48189}]}],"parallelStages":[{"parallelSet":2,"workflowId":1072,"workflowVersionId":4205,"workflowStageId":48189,"workflowStageCode":"F1Stage1StageName_Branch2","title":{"key":"branch2","type":"custom","values":[{"language":"en-US","value":"Branch2"},{"language":"zh-Hans","value":"分支2"},{"language":"id-ID","value":"Cabang2"},{"language":"ms-MY","value":"Cawangan2"},{"language":"zh-Hant","value":"分支2"},{"language":"th-TH","value":"สาขา2"}]},"displayName":{"key":"pendingbranch2","type":"custom","values":[{"language":"en-US","value":"Pending Branch 2"},{"language":"zh-Hans","value":"待定分支2"},{"language":"id-ID","value":"Cabang Tertunda 2"},{"language":"ms-MY","value":"Cawangan Tertunda 2"},{"language":"zh-Hant","value":"待定分支2"},{"language":"th-TH","value":"รอดำเนินการสาขา2"}]},"stageType":"Standard","seqNo":1,"isEndStage":false,"isApprovedStage":false,"isSLA":false,"isPublished":true,"stageConfig":{"stageTypeConfigs":[],"isAllowDelegation":false,"isAllowDelegationToGroup":false,"isAllowRequestorAssignUser":false,"hasStageReview":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOption":"OneAssignee","assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false}},"notificationCount":0,"reminderCount":0,"integrationCount":0,"deleteLock":true,"requestorSubLock":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOption":"OneAssignee","assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false},"assignedTos":[],"readers":[],"workflowStageTriggers":[],"actions":[{"workflowActionId":55879,"workflowActionCode":"52a8354a-0b05-44b0-83bf-24dc7584be87","actionType":"standard","options":{"buttonName":{"key":"Approve","type":"custom","values":[{"language":"en-US","value":"Approve"},{"language":"zh-Hans","value":"核准"},{"language":"id-ID","value":"Menyetujui"},{"language":"ms-MY","value":"Lulus"},{"language":"zh-Hant","value":"核准"},{"language":"th-TH","value":"อนุมัติ"}]},"buttonColor":"btn-primary","sequence":"1","seqNo":0,"conditionalActionEvent":false,"systemAction":true,"condition":{"conditionGroups":[]},"allowFieldValidation":false,"fieldValidationGroups":[],"workflowActionId":0},"deleteLock":true,"eventLists":[{"ruleName":"Rule 1","assignOption":"OneAssignee","events":[{"eventType":"GotoStage","workflowStageId":48190,"stageTitle":{"workflowStageId":48190,"title":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]}},"config":{}}]}],"notificationCount":0,"title":{"key":"ApproveAction ","type":"custom","values":[{"language":"en-US","value":"ApproveAction "},{"language":"zh-Hans","value":"核准"},{"language":"id-ID","value":"Menyetujui"},{"language":"ms-MY","value":"Lulus"},{"language":"zh-Hant","value":"核准"},{"language":"th-TH","value":"อนุมัติ"}]}},{"workflowActionId":55922,"workflowActionCode":"b1a6c977-c6b2-4d55-98a9-2cdfd05c343b","actionType":"standard","options":{"buttonName":{"key":"Reject","type":"custom","values":[{"language":"en-US","value":"Reject"},{"language":"zh-Hans","value":""},{"language":"id-ID","value":""},{"language":"ms-MY","value":""},{"language":"zh-Hant","value":""},{"language":"th-TH","value":""}]},"buttonColor":"btn-lightgrey","seqNo":0,"conditionalActionEvent":false,"systemAction":false,"condition":{"conditionGroups":[]},"allowFieldValidation":false,"fieldValidationGroups":[],"workflowActionId":0},"deleteLock":false,"eventLists":[{"ruleName":"Rule 1","assignOption":"OneAssignee","events":[{"eventType":"GotoStage","workflowStageId":48240,"stageTitle":{"workflowStageId":48240,"title":{"key":"Reject","type":"custom","values":[{"language":"en-US","value":"Reject"},{"language":"zh-Hans","value":""},{"language":"id-ID","value":""},{"language":"ms-MY","value":""},{"language":"zh-Hant","value":""},{"language":"th-TH","value":""}]}},"config":{}}]}],"notificationCount":0,"title":{"key":"RejectAction ","type":"custom","values":[{"language":"en-US","value":"RejectAction "},{"language":"zh-Hans","value":""},{"language":"id-ID","value":""},{"language":"ms-MY","value":""},{"language":"zh-Hant","value":""},{"language":"th-TH","value":""}]}},{"workflowActionId":56354,"workflowActionCode":"b84a25c3-028e-492e-b897-9316e6636160","actionType":"standard","options":{"buttonName":{"key":"gotomyself","type":"custom","values":[{"language":"en-US","value":"gotomyself"},{"language":"zh-Hans","value":""},{"language":"id-ID","value":""},{"language":"ms-MY","value":""},{"language":"zh-Hant","value":""},{"language":"th-TH","value":""}]},"buttonColor":"btn-lightgrey","seqNo":0,"conditionalActionEvent":false,"systemAction":false,"condition":{"conditionGroups":[]},"allowFieldValidation":false,"fieldValidationGroups":[],"workflowActionId":0},"deleteLock":false,"eventLists":[{"ruleName":"Rule 1","assignOption":"OneAssignee","events":[{"eventType":"GotoStage","workflowStageId":48189,"stageTitle":{"workflowStageId":48189,"title":{"key":"branch2","type":"custom","values":[{"language":"en-US","value":"Branch2"},{"language":"zh-Hans","value":"分支2"},{"language":"id-ID","value":"Cabang2"},{"language":"ms-MY","value":"Cawangan2"},{"language":"zh-Hant","value":"分支2"},{"language":"th-TH","value":"สาขา2"}]}},"config":{}}]}],"notificationCount":0,"title":{"key":"gotomyselfAction ","type":"custom","values":[{"language":"en-US","value":"gotomyselfAction "},{"language":"zh-Hans","value":""},{"language":"id-ID","value":""},{"language":"ms-MY","value":""},{"language":"zh-Hant","value":""},{"language":"th-TH","value":""}]}}],"parallelWorkflowStageId":48186,"parallelDeleteLock":false,"hasNoStageNotifToAssignee":true},{"parallelSet":2,"workflowId":1072,"workflowVersionId":4205,"workflowStageId":48190,"workflowStageCode":"F1Stage1StageName_BranchApproved2","title":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]},"displayName":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]},"stageType":"Standard","seqNo":2,"isEndStage":true,"isApprovedStage":true,"isSLA":false,"isPublished":true,"stageConfig":{"stageTypeConfigs":[],"isAllowDelegation":false,"isAllowDelegationToGroup":false,"isAllowRequestorAssignUser":false,"hasStageReview":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false}},"notificationCount":0,"reminderCount":0,"integrationCount":0,"deleteLock":true,"requestorSubLock":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false},"assignedTos":[],"readers":[],"workflowStageTriggers":[],"actions":[],"parallelWorkflowStageId":48186,"parallelDeleteLock":false,"hasNoStageNotifToAssignee":true},{"parallelSet":2,"workflowId":1072,"workflowVersionId":4205,"workflowStageId":48240,"workflowStageCode":"RejectStageCode2","title":{"key":"Reject","type":"custom","values":[{"language":"en-US","value":"Reject"},{"language":"zh-Hans","value":""},{"language":"id-ID","value":""},{"language":"ms-MY","value":""},{"language":"zh-Hant","value":""},{"language":"th-TH","value":""}]},"displayName":{"key":"RejectDN2","type":"custom","values":[{"language":"en-US","value":"RejectDN2"},{"language":"zh-Hans","value":""},{"language":"id-ID","value":""},{"language":"ms-MY","value":""},{"language":"zh-Hant","value":""},{"language":"th-TH","value":""}]},"stageType":"Standard","seqNo":3,"isEndStage":true,"isApprovedStage":false,"isSLA":false,"stageConfig":{"stageTypeConfigs":[],"isAllowDelegation":false,"isAllowDelegationToGroup":false,"isAllowRequestorAssignUser":false,"hasStageReview":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"noAssigneeActionEvents":[],"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"sameApproverActionEvents":[],"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOption":"OneAssignee","assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false}},"notificationCount":0,"reminderCount":0,"integrationCount":0,"deleteLock":false,"requestorSubLock":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"noAssigneeActionEvents":[],"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"sameApproverActionEvents":[],"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOption":"OneAssignee","assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false},"assignedTos":[],"readers":[],"workflowStageTriggers":[],"workflowStageSLA":{"slaDuration":0,"slaThreshold":0,"workingDays":[],"workingHoursPerDay":0},"actions":[],"parallelWorkflowStageId":48186,"parallelDeleteLock":false,"hasNoStageNotifToAssignee":true}]},"class":"branchLabel"},"branch3":{"ref":"body","width":90,"height":46,"refX":195,"refY":29,"strokeWidth":1,"stroke":"black","fill":"white"},"branch3_label":{"ref":"branch3","cursor":"pointer","event":"element:branchLabel:pointerdown","textAnchor":"middle","textVerticalAnchor":"middle","text":"branch4","title":"branch4","refX":"50%","refY":"50%","parallelSet":{"parallelSet":3,"startingConditions":[{"workflowStageParallelId":0,"workflowStageId":48186,"startingCondition":"start","startingConditionSetting":{"fields":[]},"startingStages":[{"title":"{\"key\":\"branch4\",\"type\":\"custom\",\"values\":[{\"language\":\"en-US\",\"value\":\"Branch4\"},{\"language\":\"zh-Hans\",\"value\":\"分支4\"},{\"language\":\"id-ID\",\"value\":\"Cabang4\"},{\"language\":\"ms-MY\",\"value\":\"Cawangan4\"},{\"language\":\"zh-Hant\",\"value\":\"分支4\"},{\"language\":\"th-TH\",\"value\":\"สาขา4\"}]}","workflowStageId":48250}]}],"parallelStages":[{"parallelSet":3,"workflowId":1072,"workflowVersionId":4205,"workflowStageId":48250,"workflowStageCode":"F1Stage1StageName_Branch4","title":{"key":"branch4","type":"custom","values":[{"language":"en-US","value":"Branch4"},{"language":"zh-Hans","value":"分支4"},{"language":"id-ID","value":"Cabang4"},{"language":"ms-MY","value":"Cawangan4"},{"language":"zh-Hant","value":"分支4"},{"language":"th-TH","value":"สาขา4"}]},"displayName":{"key":"pendingbranch4","type":"custom","values":[{"language":"en-US","value":"Pending Branch 4"},{"language":"zh-Hans","value":"待定分支4"},{"language":"id-ID","value":"Cabang Tertunda 4"},{"language":"ms-MY","value":"Cawangan Tertunda 4"},{"language":"zh-Hant","value":"待定分支4"},{"language":"th-TH","value":"รอดำเนินการสาขา4"}]},"stageType":"Standard","seqNo":1,"isEndStage":false,"isApprovedStage":false,"isSLA":false,"stageConfig":{"stageTypeConfigs":[],"isAllowDelegation":false,"isAllowDelegationToGroup":false,"isAllowRequestorAssignUser":false,"hasStageReview":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOption":"OneAssignee","assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false}},"notificationCount":0,"reminderCount":0,"integrationCount":0,"deleteLock":true,"requestorSubLock":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOption":"OneAssignee","assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false},"assignedTos":[],"readers":[],"workflowStageTriggers":[],"actions":[{"workflowActionId":55935,"workflowActionCode":"344cf861-34de-4267-9c06-f43438f9edb7","actionType":"standard","options":{"buttonName":{"key":"Approve","type":"custom","values":[{"language":"en-US","value":"Approve"},{"language":"zh-Hans","value":"核准"},{"language":"id-ID","value":"Menyetujui"},{"language":"ms-MY","value":"Lulus"},{"language":"zh-Hant","value":"核准"},{"language":"th-TH","value":"อนุมัติ"}]},"buttonColor":"btn-primary","sequence":"1","seqNo":0,"conditionalActionEvent":false,"systemAction":true,"condition":{"conditionGroups":[]},"allowFieldValidation":false,"fieldValidationGroups":[],"workflowActionId":0},"deleteLock":true,"eventLists":[{"ruleName":"Rule 1","assignOption":"OneAssignee","events":[{"eventType":"GotoStage","workflowStageId":48251,"stageTitle":{"workflowStageId":48251,"title":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]}},"config":{}}]}],"notificationCount":0,"title":{"key":"Approve","type":"custom","values":[{"language":"en-US","value":"Approve"},{"language":"zh-Hans","value":"核准"},{"language":"id-ID","value":"Menyetujui"},{"language":"ms-MY","value":"Lulus"},{"language":"zh-Hant","value":"核准"},{"language":"th-TH","value":"อนุมัติ"}]}}],"parallelWorkflowStageId":48186,"parallelDeleteLock":false,"hasNoStageNotifToAssignee":true},{"parallelSet":3,"workflowId":1072,"workflowVersionId":4205,"workflowStageId":48251,"workflowStageCode":"F1Stage1StageName_BranchApproved4","title":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]},"displayName":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]},"stageType":"Standard","seqNo":2,"isEndStage":true,"isApprovedStage":true,"isSLA":false,"stageConfig":{"stageTypeConfigs":[],"isAllowDelegation":false,"isAllowDelegationToGroup":false,"isAllowRequestorAssignUser":false,"hasStageReview":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false}},"notificationCount":0,"reminderCount":0,"integrationCount":0,"deleteLock":true,"requestorSubLock":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false},"assignedTos":[],"readers":[],"workflowStageTriggers":[],"actions":[],"parallelWorkflowStageId":48186,"parallelDeleteLock":false,"hasNoStageNotifToAssignee":true}]},"class":"branchLabel"},"branch4":{"ref":"body","width":90,"height":46,"refX":5,"refY":80,"strokeWidth":1,"stroke":"black","fill":"white"},"branch4_label":{"ref":"branch4","cursor":"pointer","event":"element:branchLabel:pointerdown","textAnchor":"middle","textVerticalAnchor":"middle","text":"branch5","title":"branch5","refX":"50%","refY":"50%","parallelSet":{"parallelSet":4,"startingConditions":[{"workflowStageParallelId":0,"workflowStageId":48186,"startingCondition":"start","startingConditionSetting":{"fields":[]},"startingStages":[{"title":"{\"key\":\"branch5\",\"type\":\"custom\",\"values\":[{\"language\":\"en-US\",\"value\":\"branch5\"},{\"language\":\"zh-Hans\",\"value\":\"分支4\"},{\"language\":\"id-ID\",\"value\":\"Cabang4\"},{\"language\":\"ms-MY\",\"value\":\"Cawangan4\"},{\"language\":\"zh-Hant\",\"value\":\"分支4\"},{\"language\":\"th-TH\",\"value\":\"สาขา4\"}]}","workflowStageId":48252}]}],"parallelStages":[{"parallelSet":4,"workflowId":1072,"workflowVersionId":4205,"workflowStageId":48252,"workflowStageCode":"branch5","title":{"key":"branch5","type":"custom","values":[{"language":"en-US","value":"branch5"},{"language":"zh-Hans","value":"分支4"},{"language":"id-ID","value":"Cabang4"},{"language":"ms-MY","value":"Cawangan4"},{"language":"zh-Hant","value":"分支4"},{"language":"th-TH","value":"สาขา4"}]},"displayName":{"key":"pendingbranch4","type":"custom","values":[{"language":"en-US","value":"Pending Branch 4"},{"language":"zh-Hans","value":"待定分支4"},{"language":"id-ID","value":"Cabang Tertunda 4"},{"language":"ms-MY","value":"Cawangan Tertunda 4"},{"language":"zh-Hant","value":"待定分支4"},{"language":"th-TH","value":"รอดำเนินการสาขา4"}]},"stageType":"Standard","seqNo":1,"isEndStage":false,"isApprovedStage":false,"isSLA":false,"stageConfig":{"stageTypeConfigs":[],"isAllowDelegation":false,"isAllowDelegationToGroup":false,"isAllowRequestorAssignUser":false,"hasStageReview":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"noAssigneeActionEvents":[],"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"sameApproverActionEvents":[],"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOption":"OneAssignee","assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false}},"notificationCount":0,"reminderCount":0,"integrationCount":0,"deleteLock":true,"requestorSubLock":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"noAssigneeActionEvents":[],"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"sameApproverActionEvents":[],"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOption":"OneAssignee","assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false},"assignedTos":[],"readers":[],"workflowStageTriggers":[],"workflowStageSLA":{"slaDuration":0,"slaThreshold":0,"workingDays":[],"workingHoursPerDay":0},"actions":[{"workflowActionId":55937,"workflowActionCode":"50c9256e-0097-42c3-a329-024f0e123b4a","actionType":"standard","options":{"buttonName":{"key":"Approve","type":"custom","values":[{"language":"en-US","value":"Approve"},{"language":"zh-Hans","value":"核准"},{"language":"id-ID","value":"Menyetujui"},{"language":"ms-MY","value":"Lulus"},{"language":"zh-Hant","value":"核准"},{"language":"th-TH","value":"อนุมัติ"}]},"buttonColor":"btn-primary","sequence":"1","seqNo":0,"conditionalActionEvent":false,"systemAction":true,"condition":{"conditionGroups":[]},"allowFieldValidation":false,"fieldValidationGroups":[],"workflowActionId":0},"deleteLock":true,"eventLists":[{"ruleName":"Rule 1","assignOption":"OneAssignee","events":[{"eventType":"GotoStage","workflowStageId":48253,"stageTitle":{"workflowStageId":48253,"title":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]}},"config":{}}]}],"notificationCount":0,"title":{"key":"Approve","type":"custom","values":[{"language":"en-US","value":"Approve"},{"language":"zh-Hans","value":"核准"},{"language":"id-ID","value":"Menyetujui"},{"language":"ms-MY","value":"Lulus"},{"language":"zh-Hant","value":"核准"},{"language":"th-TH","value":"อนุมัติ"}]}}],"parallelWorkflowStageId":48186,"parallelDeleteLock":false,"hasNoStageNotifToAssignee":true},{"parallelSet":4,"workflowId":1072,"workflowVersionId":4205,"workflowStageId":48253,"workflowStageCode":"F1Stage1StageName_BranchApproved4","title":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]},"displayName":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]},"stageType":"Standard","seqNo":2,"isEndStage":true,"isApprovedStage":true,"isSLA":false,"stageConfig":{"stageTypeConfigs":[],"isAllowDelegation":false,"isAllowDelegationToGroup":false,"isAllowRequestorAssignUser":false,"hasStageReview":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false}},"notificationCount":0,"reminderCount":0,"integrationCount":0,"deleteLock":true,"requestorSubLock":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false},"assignedTos":[],"readers":[],"workflowStageTriggers":[],"actions":[],"parallelWorkflowStageId":48186,"parallelDeleteLock":false,"hasNoStageNotifToAssignee":true}]},"class":"branchLabel"},"branch5":{"ref":"body","width":90,"height":46,"refX":100,"refY":80,"strokeWidth":1,"stroke":"black","fill":"white"},"branch5_label":{"ref":"branch5","cursor":"pointer","event":"element:branchLabel:pointerdown","textAnchor":"middle","textVerticalAnchor":"middle","text":"branch5","title":"branch5","refX":"50%","refY":"50%","parallelSet":{"parallelSet":5,"startingConditions":[{"workflowStageParallelId":0,"workflowStageId":48186,"startingCondition":"start","startingConditionSetting":{"fields":[]},"startingStages":[{"title":"{\"key\":\"branch5\",\"type\":\"custom\",\"values\":[{\"language\":\"en-US\",\"value\":\"Branch5\"},{\"language\":\"zh-Hans\",\"value\":\"分支5\"},{\"language\":\"id-ID\",\"value\":\"Cabang5\"},{\"language\":\"ms-MY\",\"value\":\"Cawangan5\"},{\"language\":\"zh-Hant\",\"value\":\"分支5\"},{\"language\":\"th-TH\",\"value\":\"สาขา5\"}]}","workflowStageId":48254}]}],"parallelStages":[{"parallelSet":5,"workflowId":1072,"workflowVersionId":4205,"workflowStageId":48254,"workflowStageCode":"F1Stage1StageName_Branch5","title":{"key":"branch5","type":"custom","values":[{"language":"en-US","value":"Branch5"},{"language":"zh-Hans","value":"分支5"},{"language":"id-ID","value":"Cabang5"},{"language":"ms-MY","value":"Cawangan5"},{"language":"zh-Hant","value":"分支5"},{"language":"th-TH","value":"สาขา5"}]},"displayName":{"key":"pendingbranch5","type":"custom","values":[{"language":"en-US","value":"Pending Branch 5"},{"language":"zh-Hans","value":"待定分支5"},{"language":"id-ID","value":"Cabang Tertunda 5"},{"language":"ms-MY","value":"Cawangan Tertunda 5"},{"language":"zh-Hant","value":"待定分支5"},{"language":"th-TH","value":"รอดำเนินการสาขา5"}]},"stageType":"Standard","seqNo":1,"isEndStage":false,"isApprovedStage":false,"isSLA":false,"stageConfig":{"stageTypeConfigs":[],"isAllowDelegation":false,"isAllowDelegationToGroup":false,"isAllowRequestorAssignUser":false,"hasStageReview":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOption":"OneAssignee","assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false}},"notificationCount":0,"reminderCount":0,"integrationCount":0,"deleteLock":true,"requestorSubLock":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOption":"OneAssignee","assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false},"assignedTos":[],"readers":[],"workflowStageTriggers":[],"actions":[{"workflowActionId":55939,"workflowActionCode":"46779756-d009-4323-8c90-4596348c3282","actionType":"standard","options":{"buttonName":{"key":"Approve","type":"custom","values":[{"language":"en-US","value":"Approve"},{"language":"zh-Hans","value":"核准"},{"language":"id-ID","value":"Menyetujui"},{"language":"ms-MY","value":"Lulus"},{"language":"zh-Hant","value":"核准"},{"language":"th-TH","value":"อนุมัติ"}]},"buttonColor":"btn-primary","sequence":"1","seqNo":0,"conditionalActionEvent":false,"systemAction":true,"condition":{"conditionGroups":[]},"allowFieldValidation":false,"fieldValidationGroups":[],"workflowActionId":0},"deleteLock":true,"eventLists":[{"ruleName":"Rule 1","assignOption":"OneAssignee","events":[{"eventType":"GotoStage","workflowStageId":48255,"stageTitle":{"workflowStageId":48255,"title":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]}},"config":{}}]}],"notificationCount":0,"title":{"key":"Approve","type":"custom","values":[{"language":"en-US","value":"Approve"},{"language":"zh-Hans","value":"核准"},{"language":"id-ID","value":"Menyetujui"},{"language":"ms-MY","value":"Lulus"},{"language":"zh-Hant","value":"核准"},{"language":"th-TH","value":"อนุมัติ"}]}}],"parallelWorkflowStageId":48186,"parallelDeleteLock":false,"hasNoStageNotifToAssignee":true},{"parallelSet":5,"workflowId":1072,"workflowVersionId":4205,"workflowStageId":48255,"workflowStageCode":"F1Stage1StageName_BranchApproved5","title":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]},"displayName":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]},"stageType":"Standard","seqNo":2,"isEndStage":true,"isApprovedStage":true,"isSLA":false,"stageConfig":{"stageTypeConfigs":[],"isAllowDelegation":false,"isAllowDelegationToGroup":false,"isAllowRequestorAssignUser":false,"hasStageReview":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false}},"notificationCount":0,"reminderCount":0,"integrationCount":0,"deleteLock":true,"requestorSubLock":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false},"assignedTos":[],"readers":[],"workflowStageTriggers":[],"actions":[],"parallelWorkflowStageId":48186,"parallelDeleteLock":false,"hasNoStageNotifToAssignee":true}]},"class":"branchLabel"},"branch6":{"ref":"body","width":90,"height":46,"refX":195,"refY":80,"strokeWidth":1,"stroke":"black","fill":"white"},"branch6_label":{"ref":"branch6","cursor":"pointer","event":"element:branchLabel:pointerdown","textAnchor":"middle","textVerticalAnchor":"middle","text":"branch6","title":"branch6","refX":"50%","refY":"50%","parallelSet":{"parallelSet":6,"startingConditions":[{"workflowStageParallelId":0,"workflowStageId":48186,"startingCondition":"start","startingConditionSetting":{"fields":[]},"startingStages":[{"title":"{\"key\":\"branch6\",\"type\":\"custom\",\"values\":[{\"language\":\"en-US\",\"value\":\"Branch6\"},{\"language\":\"zh-Hans\",\"value\":\"分支6\"},{\"language\":\"id-ID\",\"value\":\"Cabang6\"},{\"language\":\"ms-MY\",\"value\":\"Cawangan6\"},{\"language\":\"zh-Hant\",\"value\":\"分支6\"},{\"language\":\"th-TH\",\"value\":\"สาขา6\"}]}","workflowStageId":48256}]}],"parallelStages":[{"parallelSet":6,"workflowId":1072,"workflowVersionId":4205,"workflowStageId":48256,"workflowStageCode":"F1Stage1StageName_Branch6","title":{"key":"branch6","type":"custom","values":[{"language":"en-US","value":"Branch6"},{"language":"zh-Hans","value":"分支6"},{"language":"id-ID","value":"Cabang6"},{"language":"ms-MY","value":"Cawangan6"},{"language":"zh-Hant","value":"分支6"},{"language":"th-TH","value":"สาขา6"}]},"displayName":{"key":"pendingbranch6","type":"custom","values":[{"language":"en-US","value":"Pending Branch 6"},{"language":"zh-Hans","value":"待定分支6"},{"language":"id-ID","value":"Cabang Tertunda 6"},{"language":"ms-MY","value":"Cawangan Tertunda 6"},{"language":"zh-Hant","value":"待定分支6"},{"language":"th-TH","value":"รอดำเนินการสาขา6"}]},"stageType":"Standard","seqNo":1,"isEndStage":false,"isApprovedStage":false,"isSLA":false,"stageConfig":{"stageTypeConfigs":[],"isAllowDelegation":false,"isAllowDelegationToGroup":false,"isAllowRequestorAssignUser":false,"hasStageReview":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOption":"OneAssignee","assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false}},"notificationCount":0,"reminderCount":0,"integrationCount":0,"deleteLock":true,"requestorSubLock":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOption":"OneAssignee","assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false},"assignedTos":[],"readers":[],"workflowStageTriggers":[],"actions":[{"workflowActionId":55941,"workflowActionCode":"cdda8106-85d9-46df-a31b-78144e9e0ce4","actionType":"standard","options":{"buttonName":{"key":"Approve","type":"custom","values":[{"language":"en-US","value":"Approve"},{"language":"zh-Hans","value":"核准"},{"language":"id-ID","value":"Menyetujui"},{"language":"ms-MY","value":"Lulus"},{"language":"zh-Hant","value":"核准"},{"language":"th-TH","value":"อนุมัติ"}]},"buttonColor":"btn-primary","sequence":"1","seqNo":0,"conditionalActionEvent":false,"systemAction":true,"condition":{"conditionGroups":[]},"allowFieldValidation":false,"fieldValidationGroups":[],"workflowActionId":0},"deleteLock":true,"eventLists":[{"ruleName":"Rule 1","assignOption":"OneAssignee","events":[{"eventType":"GotoStage","workflowStageId":48257,"stageTitle":{"workflowStageId":48257,"title":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]}},"config":{}}]}],"notificationCount":0,"title":{"key":"Approve","type":"custom","values":[{"language":"en-US","value":"Approve"},{"language":"zh-Hans","value":"核准"},{"language":"id-ID","value":"Menyetujui"},{"language":"ms-MY","value":"Lulus"},{"language":"zh-Hant","value":"核准"},{"language":"th-TH","value":"อนุมัติ"}]}}],"parallelWorkflowStageId":48186,"parallelDeleteLock":false,"hasNoStageNotifToAssignee":true},{"parallelSet":6,"workflowId":1072,"workflowVersionId":4205,"workflowStageId":48257,"workflowStageCode":"F1Stage1StageName_BranchApproved6","title":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]},"displayName":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]},"stageType":"Standard","seqNo":2,"isEndStage":true,"isApprovedStage":true,"isSLA":false,"stageConfig":{"stageTypeConfigs":[],"isAllowDelegation":false,"isAllowDelegationToGroup":false,"isAllowRequestorAssignUser":false,"hasStageReview":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false}},"notificationCount":0,"reminderCount":0,"integrationCount":0,"deleteLock":true,"requestorSubLock":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false},"assignedTos":[],"readers":[],"workflowStageTriggers":[],"actions":[],"parallelWorkflowStageId":48186,"parallelDeleteLock":false,"hasNoStageNotifToAssignee":true}]},"class":"branchLabel"},"branch7":{"ref":"body","width":90,"height":46,"refX":5,"refY":131,"strokeWidth":1,"stroke":"black","fill":"white"},"branch7_label":{"ref":"branch7","cursor":"pointer","event":"element:branchLabel:pointerdown","textAnchor":"middle","textVerticalAnchor":"middle","text":"branch7","title":"branch7","refX":"50%","refY":"50%","parallelSet":{"parallelSet":7,"startingConditions":[{"workflowStageParallelId":0,"workflowStageId":48186,"startingCondition":"start","startingConditionSetting":{"fields":[]},"startingStages":[{"title":"{\"key\":\"branch7\",\"type\":\"custom\",\"values\":[{\"language\":\"en-US\",\"value\":\"Branch7\"},{\"language\":\"zh-Hans\",\"value\":\"分支7\"},{\"language\":\"id-ID\",\"value\":\"Cabang7\"},{\"language\":\"ms-MY\",\"value\":\"Cawangan7\"},{\"language\":\"zh-Hant\",\"value\":\"分支7\"},{\"language\":\"th-TH\",\"value\":\"สาขา7\"}]}","workflowStageId":48258}]}],"parallelStages":[{"parallelSet":7,"workflowId":1072,"workflowVersionId":4205,"workflowStageId":48258,"workflowStageCode":"F1Stage1StageName_Branch7","title":{"key":"branch7","type":"custom","values":[{"language":"en-US","value":"Branch7"},{"language":"zh-Hans","value":"分支7"},{"language":"id-ID","value":"Cabang7"},{"language":"ms-MY","value":"Cawangan7"},{"language":"zh-Hant","value":"分支7"},{"language":"th-TH","value":"สาขา7"}]},"displayName":{"key":"pendingbranch7","type":"custom","values":[{"language":"en-US","value":"Pending Branch 7"},{"language":"zh-Hans","value":"待定分支7"},{"language":"id-ID","value":"Cabang Tertunda 7"},{"language":"ms-MY","value":"Cawangan Tertunda 7"},{"language":"zh-Hant","value":"待定分支7"},{"language":"th-TH","value":"รอดำเนินการสาขา7"}]},"stageType":"Standard","seqNo":1,"isEndStage":false,"isApprovedStage":false,"isSLA":false,"stageConfig":{"stageTypeConfigs":[],"isAllowDelegation":false,"isAllowDelegationToGroup":false,"isAllowRequestorAssignUser":false,"hasStageReview":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOption":"OneAssignee","assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false}},"notificationCount":0,"reminderCount":0,"integrationCount":0,"deleteLock":true,"requestorSubLock":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOption":"OneAssignee","assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false},"assignedTos":[],"readers":[],"workflowStageTriggers":[],"actions":[{"workflowActionId":55943,"workflowActionCode":"9fb2ccbd-a051-4b18-b850-47f20d856ad4","actionType":"standard","options":{"buttonName":{"key":"Approve","type":"custom","values":[{"language":"en-US","value":"Approve"},{"language":"zh-Hans","value":"核准"},{"language":"id-ID","value":"Menyetujui"},{"language":"ms-MY","value":"Lulus"},{"language":"zh-Hant","value":"核准"},{"language":"th-TH","value":"อนุมัติ"}]},"buttonColor":"btn-primary","sequence":"1","seqNo":0,"conditionalActionEvent":false,"systemAction":true,"condition":{"conditionGroups":[]},"allowFieldValidation":false,"fieldValidationGroups":[],"workflowActionId":0},"deleteLock":true,"eventLists":[{"ruleName":"Rule 1","assignOption":"OneAssignee","events":[{"eventType":"GotoStage","workflowStageId":48259,"stageTitle":{"workflowStageId":48259,"title":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]}},"config":{}}]}],"notificationCount":0,"title":{"key":"Approve","type":"custom","values":[{"language":"en-US","value":"Approve"},{"language":"zh-Hans","value":"核准"},{"language":"id-ID","value":"Menyetujui"},{"language":"ms-MY","value":"Lulus"},{"language":"zh-Hant","value":"核准"},{"language":"th-TH","value":"อนุมัติ"}]}}],"parallelWorkflowStageId":48186,"parallelDeleteLock":false,"hasNoStageNotifToAssignee":true},{"parallelSet":7,"workflowId":1072,"workflowVersionId":4205,"workflowStageId":48259,"workflowStageCode":"F1Stage1StageName_BranchApproved7","title":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]},"displayName":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]},"stageType":"Standard","seqNo":2,"isEndStage":true,"isApprovedStage":true,"isSLA":false,"stageConfig":{"stageTypeConfigs":[],"isAllowDelegation":false,"isAllowDelegationToGroup":false,"isAllowRequestorAssignUser":false,"hasStageReview":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false}},"notificationCount":0,"reminderCount":0,"integrationCount":0,"deleteLock":true,"requestorSubLock":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false},"assignedTos":[],"readers":[],"workflowStageTriggers":[],"actions":[],"parallelWorkflowStageId":48186,"parallelDeleteLock":false,"hasNoStageNotifToAssignee":true}]},"class":"branchLabel"}}},{"type":"standard.Rectangle","position":{"x":612.5,"y":371},"size":{"width":140,"height":60},"angle":0,"id":"46272","seqNo":3,"attrs":{"body":{"strokeWidth":1.5,"stroke":"black","fill":"rgb(49, 197, 255)"},"label":{"fill":"black","text":"F1Stage2StageName","title":"F1Stage2StageName"}}},{"type":"custom.ParallelRectangle","position":{"x":312.5,"y":752},"size":{"width":290,"height":80},"angle":0,"id":"48981","currentStageName":"F1Stage3StageName","attrs":{"header":{"title":"F1Stage3StageName"},"icon":{"id":48981},"titleLabel":{"text":"F1Stage3StageName"},"branch8":{"ref":"body","width":90,"height":46,"refX":5,"refY":29,"strokeWidth":1,"stroke":"black","fill":"white"},"branch8_label":{"ref":"branch8","cursor":"pointer","event":"element:branchLabel:pointerdown","textAnchor":"middle","textVerticalAnchor":"middle","text":"branch1","title":"branch1","refX":"50%","refY":"50%","parallelSet":{"parallelSet":1,"startingConditions":[{"workflowStageParallelId":0,"workflowStageId":48981,"startingCondition":"start","startingConditionSetting":{"fields":[]},"startingStages":[{"title":"{\"key\":\"branch1\",\"type\":\"custom\",\"values\":[{\"language\":\"en-US\",\"value\":\"Branch1\"},{\"language\":\"zh-Hans\",\"value\":\"分支1\"},{\"language\":\"id-ID\",\"value\":\"Cabang1\"},{\"language\":\"ms-MY\",\"value\":\"Cawangan1\"},{\"language\":\"zh-Hant\",\"value\":\"分支1\"},{\"language\":\"th-TH\",\"value\":\"สาขา1\"}]}","workflowStageId":48982}]}],"parallelStages":[{"parallelSet":1,"workflowId":1072,"workflowVersionId":4205,"workflowStageId":48982,"workflowStageCode":"F1Stage3StageCode_Branch1","title":{"key":"branch1","type":"custom","values":[{"language":"en-US","value":"Branch1"},{"language":"zh-Hans","value":"分支1"},{"language":"id-ID","value":"Cabang1"},{"language":"ms-MY","value":"Cawangan1"},{"language":"zh-Hant","value":"分支1"},{"language":"th-TH","value":"สาขา1"}]},"displayName":{"key":"pendingbranch1","type":"custom","values":[{"language":"en-US","value":"Pending Branch 1"},{"language":"zh-Hans","value":"待定分支1"},{"language":"id-ID","value":"Cabang Tertunda 1"},{"language":"ms-MY","value":"Cawangan Tertunda 1"},{"language":"zh-Hant","value":"待定分支1"},{"language":"th-TH","value":"รอดำเนินการสาขา1"}]},"stageType":"Standard","seqNo":1,"isEndStage":false,"isApprovedStage":false,"isSLA":false,"stageConfig":{"stageTypeConfigs":[],"isAllowDelegation":false,"isAllowDelegationToGroup":false,"isAllowRequestorAssignUser":false,"hasStageReview":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOption":"OneAssignee","assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false}},"notificationCount":0,"reminderCount":0,"integrationCount":0,"deleteLock":true,"requestorSubLock":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOption":"OneAssignee","assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false},"assignedTos":[],"readers":[],"workflowStageTriggers":[],"actions":[{"workflowActionId":56600,"workflowActionCode":"4f96ee26-4eae-4ca1-8868-16a3207126b6","actionType":"standard","options":{"buttonName":{"key":"Approve","type":"custom","values":[{"language":"en-US","value":"Approve"},{"language":"zh-Hans","value":"核准"},{"language":"id-ID","value":"Menyetujui"},{"language":"ms-MY","value":"Lulus"},{"language":"zh-Hant","value":"核准"},{"language":"th-TH","value":"อนุมัติ"}]},"buttonColor":"btn-primary","sequence":"1","seqNo":0,"conditionalActionEvent":false,"systemAction":true,"condition":{"conditionGroups":[]},"allowFieldValidation":false,"fieldValidationGroups":[],"workflowActionId":0},"deleteLock":true,"eventLists":[{"ruleName":"Rule 1","assignOption":"OneAssignee","events":[{"eventType":"GotoStage","workflowStageId":48983,"stageTitle":{"workflowStageId":48983,"title":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]}},"config":{}}]}],"notificationCount":0,"title":{"key":"Approve","type":"custom","values":[{"language":"en-US","value":"Approve"},{"language":"zh-Hans","value":"核准"},{"language":"id-ID","value":"Menyetujui"},{"language":"ms-MY","value":"Lulus"},{"language":"zh-Hant","value":"核准"},{"language":"th-TH","value":"อนุมัติ"}]}}],"parallelWorkflowStageId":48981,"parallelDeleteLock":false,"hasNoStageNotifToAssignee":true},{"parallelSet":1,"workflowId":1072,"workflowVersionId":4205,"workflowStageId":48983,"workflowStageCode":"F1Stage3StageCode_BranchApproved1","title":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]},"displayName":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]},"stageType":"Standard","seqNo":2,"isEndStage":true,"isApprovedStage":true,"isSLA":false,"stageConfig":{"stageTypeConfigs":[],"isAllowDelegation":false,"isAllowDelegationToGroup":false,"isAllowRequestorAssignUser":false,"hasStageReview":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false}},"notificationCount":0,"reminderCount":0,"integrationCount":0,"deleteLock":true,"requestorSubLock":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false},"assignedTos":[],"readers":[],"workflowStageTriggers":[],"actions":[],"parallelWorkflowStageId":48981,"parallelDeleteLock":false,"hasNoStageNotifToAssignee":true}]},"class":"branchLabel"},"branch9":{"ref":"body","width":90,"height":46,"refX":100,"refY":29,"strokeWidth":1,"stroke":"black","fill":"white"},"branch9_label":{"ref":"branch9","cursor":"pointer","event":"element:branchLabel:pointerdown","textAnchor":"middle","textVerticalAnchor":"middle","text":"branch2","title":"branch2","refX":"50%","refY":"50%","parallelSet":{"parallelSet":2,"startingConditions":[{"workflowStageParallelId":0,"workflowStageId":48981,"startingCondition":"start","startingConditionSetting":{"fields":[]},"startingStages":[{"title":"{\"key\":\"branch2\",\"type\":\"custom\",\"values\":[{\"language\":\"en-US\",\"value\":\"Branch2\"},{\"language\":\"zh-Hans\",\"value\":\"分支2\"},{\"language\":\"id-ID\",\"value\":\"Cabang2\"},{\"language\":\"ms-MY\",\"value\":\"Cawangan2\"},{\"language\":\"zh-Hant\",\"value\":\"分支2\"},{\"language\":\"th-TH\",\"value\":\"สาขา2\"}]}","workflowStageId":48984}]}],"parallelStages":[{"parallelSet":2,"workflowId":1072,"workflowVersionId":4205,"workflowStageId":48984,"workflowStageCode":"F1Stage3StageCode_Branch2","title":{"key":"branch2","type":"custom","values":[{"language":"en-US","value":"Branch2"},{"language":"zh-Hans","value":"分支2"},{"language":"id-ID","value":"Cabang2"},{"language":"ms-MY","value":"Cawangan2"},{"language":"zh-Hant","value":"分支2"},{"language":"th-TH","value":"สาขา2"}]},"displayName":{"key":"pendingbranch2","type":"custom","values":[{"language":"en-US","value":"Pending Branch 2"},{"language":"zh-Hans","value":"待定分支2"},{"language":"id-ID","value":"Cabang Tertunda 2"},{"language":"ms-MY","value":"Cawangan Tertunda 2"},{"language":"zh-Hant","value":"待定分支2"},{"language":"th-TH","value":"รอดำเนินการสาขา2"}]},"stageType":"Standard","seqNo":1,"isEndStage":false,"isApprovedStage":false,"isSLA":false,"stageConfig":{"stageTypeConfigs":[],"isAllowDelegation":false,"isAllowDelegationToGroup":false,"isAllowRequestorAssignUser":false,"hasStageReview":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOption":"OneAssignee","assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false}},"notificationCount":0,"reminderCount":0,"integrationCount":0,"deleteLock":true,"requestorSubLock":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOption":"OneAssignee","assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false},"assignedTos":[],"readers":[],"workflowStageTriggers":[],"actions":[{"workflowActionId":56602,"workflowActionCode":"db0306c1-84df-4bc6-87a2-0f6c2d938a0a","actionType":"standard","options":{"buttonName":{"key":"Approve","type":"custom","values":[{"language":"en-US","value":"Approve"},{"language":"zh-Hans","value":"核准"},{"language":"id-ID","value":"Menyetujui"},{"language":"ms-MY","value":"Lulus"},{"language":"zh-Hant","value":"核准"},{"language":"th-TH","value":"อนุมัติ"}]},"buttonColor":"btn-primary","sequence":"1","seqNo":0,"conditionalActionEvent":false,"systemAction":true,"condition":{"conditionGroups":[]},"allowFieldValidation":false,"fieldValidationGroups":[],"workflowActionId":0},"deleteLock":true,"eventLists":[{"ruleName":"Rule 1","assignOption":"OneAssignee","events":[{"eventType":"GotoStage","workflowStageId":48985,"stageTitle":{"workflowStageId":48985,"title":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]}},"config":{}}]}],"notificationCount":0,"title":{"key":"Approve","type":"custom","values":[{"language":"en-US","value":"Approve"},{"language":"zh-Hans","value":"核准"},{"language":"id-ID","value":"Menyetujui"},{"language":"ms-MY","value":"Lulus"},{"language":"zh-Hant","value":"核准"},{"language":"th-TH","value":"อนุมัติ"}]}}],"parallelWorkflowStageId":48981,"parallelDeleteLock":false,"hasNoStageNotifToAssignee":true},{"parallelSet":2,"workflowId":1072,"workflowVersionId":4205,"workflowStageId":48985,"workflowStageCode":"F1Stage3StageCode_BranchApproved2","title":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]},"displayName":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]},"stageType":"Standard","seqNo":2,"isEndStage":true,"isApprovedStage":true,"isSLA":false,"stageConfig":{"stageTypeConfigs":[],"isAllowDelegation":false,"isAllowDelegationToGroup":false,"isAllowRequestorAssignUser":false,"hasStageReview":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false}},"notificationCount":0,"reminderCount":0,"integrationCount":0,"deleteLock":true,"requestorSubLock":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false},"assignedTos":[],"readers":[],"workflowStageTriggers":[],"actions":[],"parallelWorkflowStageId":48981,"parallelDeleteLock":false,"hasNoStageNotifToAssignee":true}]},"class":"branchLabel"},"branch10":{"ref":"body","width":90,"height":46,"refX":195,"refY":29,"strokeWidth":1,"stroke":"black","fill":"white"},"branch10_label":{"ref":"branch10","cursor":"pointer","event":"element:branchLabel:pointerdown","textAnchor":"middle","textVerticalAnchor":"middle","text":"branch3","title":"branch3","refX":"50%","refY":"50%","parallelSet":{"parallelSet":3,"startingConditions":[{"workflowStageParallelId":0,"workflowStageId":48981,"startingCondition":"start","startingConditionSetting":{"fields":[]},"startingStages":[{"title":"{\"key\":\"branch3\",\"type\":\"custom\",\"values\":[{\"language\":\"en-US\",\"value\":\"Branch3\"},{\"language\":\"zh-Hans\",\"value\":\"分支3\"},{\"language\":\"id-ID\",\"value\":\"Cabang3\"},{\"language\":\"ms-MY\",\"value\":\"Cawangan3\"},{\"language\":\"zh-Hant\",\"value\":\"分支3\"},{\"language\":\"th-TH\",\"value\":\"สาขา3\"}]}","workflowStageId":48986}]}],"parallelStages":[{"parallelSet":3,"workflowId":1072,"workflowVersionId":4205,"workflowStageId":48986,"workflowStageCode":"F1Stage3StageCode_Branch3","title":{"key":"branch3","type":"custom","values":[{"language":"en-US","value":"Branch3"},{"language":"zh-Hans","value":"分支3"},{"language":"id-ID","value":"Cabang3"},{"language":"ms-MY","value":"Cawangan3"},{"language":"zh-Hant","value":"分支3"},{"language":"th-TH","value":"สาขา3"}]},"displayName":{"key":"pendingbranch3","type":"custom","values":[{"language":"en-US","value":"Pending Branch 3"},{"language":"zh-Hans","value":"待定分支3"},{"language":"id-ID","value":"Cabang Tertunda 3"},{"language":"ms-MY","value":"Cawangan Tertunda 3"},{"language":"zh-Hant","value":"待定分支3"},{"language":"th-TH","value":"รอดำเนินการสาขา3"}]},"stageType":"Standard","seqNo":1,"isEndStage":false,"isApprovedStage":false,"isSLA":false,"stageConfig":{"stageTypeConfigs":[],"isAllowDelegation":false,"isAllowDelegationToGroup":false,"isAllowRequestorAssignUser":false,"hasStageReview":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOption":"OneAssignee","assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false}},"notificationCount":0,"reminderCount":0,"integrationCount":0,"deleteLock":true,"requestorSubLock":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOption":"OneAssignee","assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false},"assignedTos":[],"readers":[],"workflowStageTriggers":[],"actions":[{"workflowActionId":56604,"workflowActionCode":"53f122a1-d937-4e9b-9dd0-2c646b81c413","actionType":"standard","options":{"buttonName":{"key":"Approve","type":"custom","values":[{"language":"en-US","value":"Approve"},{"language":"zh-Hans","value":"核准"},{"language":"id-ID","value":"Menyetujui"},{"language":"ms-MY","value":"Lulus"},{"language":"zh-Hant","value":"核准"},{"language":"th-TH","value":"อนุมัติ"}]},"buttonColor":"btn-primary","sequence":"1","seqNo":0,"conditionalActionEvent":false,"systemAction":true,"condition":{"conditionGroups":[]},"allowFieldValidation":false,"fieldValidationGroups":[],"workflowActionId":0},"deleteLock":true,"eventLists":[{"ruleName":"Rule 1","assignOption":"OneAssignee","events":[{"eventType":"GotoStage","workflowStageId":48987,"stageTitle":{"workflowStageId":48987,"title":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]}},"config":{}}]}],"notificationCount":0,"title":{"key":"Approve","type":"custom","values":[{"language":"en-US","value":"Approve"},{"language":"zh-Hans","value":"核准"},{"language":"id-ID","value":"Menyetujui"},{"language":"ms-MY","value":"Lulus"},{"language":"zh-Hant","value":"核准"},{"language":"th-TH","value":"อนุมัติ"}]}}],"parallelWorkflowStageId":48981,"parallelDeleteLock":false,"hasNoStageNotifToAssignee":true},{"parallelSet":3,"workflowId":1072,"workflowVersionId":4205,"workflowStageId":48987,"workflowStageCode":"F1Stage3StageCode_BranchApproved3","title":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]},"displayName":{"key":"approved","type":"custom","values":[{"language":"en-US","value":"Approved"},{"language":"zh-Hans","value":"已核准"},{"language":"id-ID","value":"Disetujui"},{"language":"ms-MY","value":"Diluluskan"},{"language":"zh-Hant","value":"已核准"},{"language":"th-TH","value":"ที่ได้รับการอนุมัติ"}]},"stageType":"Standard","seqNo":2,"isEndStage":true,"isApprovedStage":true,"isSLA":false,"stageConfig":{"stageTypeConfigs":[],"isAllowDelegation":false,"isAllowDelegationToGroup":false,"isAllowRequestorAssignUser":false,"hasStageReview":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false}},"notificationCount":0,"reminderCount":0,"integrationCount":0,"deleteLock":true,"requestorSubLock":false,"options":{"displaySequence":0,"isAllowComment":false,"isAllowCommentInGeneralComment":false,"isAllowCommentCustomize":false,"isAllowEditOtherFields":false,"isAllowTrigger":false,"isSignatureEnabled":false,"isSavableByApprover":false,"hasNoAssigneeAction":false,"hasSameApproverAction":false,"hasAvoidSkipSameApproverAction":false,"isMandatoryComment":false,"isSignatureMandatory":false,"minCharacter":0,"customizeComments":[],"approverStages":[],"assignOptionNumber":0,"skipMyTaskForSameRequestorApprover":false,"runIntegrationSynchronously":false},"assignedTos":[],"readers":[],"workflowStageTriggers":[],"actions":[],"parallelWorkflowStageId":48981,"parallelDeleteLock":false,"hasNoStageNotifToAssignee":true}]},"class":"branchLabel"}}},{"type":"standard.Rectangle","position":{"x":75,"y":942},"size":{"width":140,"height":60},"angle":0,"id":"46271","seqNo":5,"attrs":{"body":{"strokeWidth":1.5,"stroke":"black","fill":"rgb(169, 255, 163)"},"label":{"fill":"black","text":"Approved","title":"Approved"}}},{"type":"standard.Rectangle","position":{"x":837.5,"y":762},"size":{"width":140,"height":60},"angle":0,"id":"48241","seqNo":6,"attrs":{"body":{"strokeWidth":1.5,"stroke":"black","fill":"rgb(255, 94, 105)"},"label":{"fill":"black","text":"RejectEndStage","title":"RejectEndStage"}}},{"position":{"x":125,"y":602},"size":{"width":40,"height":40},"angle":0,"markup":[{"tagName":"path","selector":"body"}],"type":"custom.Decision","parentId":48186,"seqNo":2,"id":"68a83ac0-f106-4968-8ed7-e832a57c666a","attrs":{"body":{"fill":"white","stroke":"black","strokeWidth":2,"d":"M 20 0 L 40 20 L 20 40 L 0 20 z"}}},{"position":{"x":662.5,"y":602},"size":{"width":40,"height":40},"angle":0,"markup":[{"tagName":"path","selector":"body"}],"type":"custom.Decision","parentId":46272,"seqNo":3,"id":"29fe29bf-19ff-4925-9dcd-2aa3885daab0","attrs":{"body":{"fill":"white","stroke":"black","strokeWidth":2,"d":"M 20 0 L 40 20 L 20 40 L 0 20 z"}}},{"type":"standard.Link","source":{"id":"startNode","anchor":{"name":"perpendicular","args":{"dx":0,"dy":0}}},"target":{"id":46270,"anchor":{"name":"perpendicular","args":{"dx":0,"dy":0}}},"defaultLabel":{"markup":[{"namespaceURI":"http://www.w3.org/2000/svg","tagName":"rect","style":{},"selector":"labelBody"},{"namespaceURI":"http://www.w3.org/2000/svg","tagName":"text","style":{},"selector":"labelText"}],"attrs":{"labelText":{"fill":"#333","fontSize":12,"fontFamily":"sans-serif","fontWeight":"bold","textAnchor":"middle","textVerticalAnchor":"middle","class":"textLabel"},"labelBody":{"rx":2,"ry":2,"ref":"labelText","x":"calc(x - 3)","y":"calc(y - 3)","width":"calc(w + 6)","height":"calc(h + 6)","fill":"white","stroke":"black","class":"textLabelBody"}}},"connector":{"name":"jumpover"},"smooth":false,"id":"b211273e-bf0e-4d9d-b7c3-5d024499f907","vertices":[],"attrs":{"line":{"stroke":"black","stroke-width":2}}},{"type":"standard.Link","source":{"id":46270,"anchor":{"name":"perpendicular","args":{"dx":0,"dy":0}}},"target":{"id":48186,"anchor":{"name":"perpendicular","args":{"dx":0,"dy":0}}},"defaultLabel":{"markup":[{"namespaceURI":"http://www.w3.org/2000/svg","tagName":"rect","style":{},"selector":"labelBody"},{"namespaceURI":"http://www.w3.org/2000/svg","tagName":"text","style":{},"selector":"labelText"}],"attrs":{"labelText":{"fill":"#333","fontSize":12,"fontFamily":"sans-serif","fontWeight":"bold","textAnchor":"middle","textVerticalAnchor":"middle","class":"textLabel"},"labelBody":{"rx":2,"ry":2,"ref":"labelText","x":"calc(x - 3)","y":"calc(y - 3)","width":"calc(w + 6)","height":"calc(h + 6)","fill":"white","stroke":"black","class":"textLabelBody"}}},"connector":{"name":"jumpover"},"smooth":false,"id":"c65b6fad-1794-46c8-bd73-164c5515192d","labels":[{"attrs":{"labelText":{"text":"Submitted","title":"Submitted","z":9,"textAnchor":"middle"}},"position":{"distance":0.4}}],"vertices":[],"attrs":{"line":{"stroke":"black","stroke-width":2}}},{"type":"standard.Link","source":{"id":48186,"anchor":{"name":"perpendicular","args":{"dx":0,"dy":0}}},"target":{"id":"68a83ac0-f106-4968-8ed7-e832a57c666a","anchor":{"name":"perpendicular","args":{"dx":0,"dy":0}}},"defaultLabel":{"markup":[{"namespaceURI":"http://www.w3.org/2000/svg","tagName":"rect","style":{},"selector":"labelBody"},{"namespaceURI":"http://www.w3.org/2000/svg","tagName":"text","style":{},"selector":"labelText"}],"attrs":{"labelText":{"fill":"#333","fontSize":12,"fontFamily":"sans-serif","fontWeight":"bold","textAnchor":"middle","textVerticalAnchor":"middle","class":"textLabel"},"labelBody":{"rx":2,"ry":2,"ref":"labelText","x":"calc(x - 3)","y":"calc(y - 3)","width":"calc(w + 6)","height":"calc(h + 6)","fill":"white","stroke":"black","class":"textLabelBody"}}},"connector":{"name":"jumpover"},"smooth":false,"id":"67ae4480-3b36-41ac-9df2-95211b871e82","vertices":[],"attrs":{"line":{"stroke":"black","stroke-width":2}}},{"type":"standard.Link","source":{"id":"68a83ac0-f106-4968-8ed7-e832a57c666a","anchor":{"name":"perpendicular","args":{"dx":0,"dy":0}}},"target":{"id":48981,"anchor":{"name":"perpendicular","args":{"dx":0,"dy":0}}},"defaultLabel":{"markup":[{"namespaceURI":"http://www.w3.org/2000/svg","tagName":"rect","style":{},"selector":"labelBody"},{"namespaceURI":"http://www.w3.org/2000/svg","tagName":"text","style":{},"selector":"labelText"}],"attrs":{"labelText":{"fill":"#333","fontSize":12,"fontFamily":"sans-serif","fontWeight":"bold","textAnchor":"middle","textVerticalAnchor":"middle","class":"textLabel"},"labelBody":{"rx":2,"ry":2,"ref":"labelText","x":"calc(x - 3)","y":"calc(y - 3)","width":"calc(w + 6)","height":"calc(h + 6)","fill":"white","stroke":"black","class":"textLabelBody"}}},"connector":{"name":"jumpover"},"smooth":false,"id":"55b2e744-b280-4f97-ad97-a78dc8754fd1","labels":[{"attrs":{"labelText":{"text":"Parallel Approved","title":"Parallel Approved","z":9,"textAnchor":"middle"}},"position":{"distance":0.4}}],"vertices":[{"x":457.5,"y":697}],"attrs":{"line":{"stroke":"black","stroke-width":2}}},{"type":"standard.Link","source":{"id":"68a83ac0-f106-4968-8ed7-e832a57c666a","anchor":{"name":"perpendicular","args":{"dx":0,"dy":0}}},"target":{"id":46271,"anchor":{"name":"perpendicular","args":{"dx":0,"dy":0}}},"defaultLabel":{"markup":[{"namespaceURI":"http://www.w3.org/2000/svg","tagName":"rect","style":{},"selector":"labelBody"},{"namespaceURI":"http://www.w3.org/2000/svg","tagName":"text","style":{},"selector":"labelText"}],"attrs":{"labelText":{"fill":"#333","fontSize":12,"fontFamily":"sans-serif","fontWeight":"bold","textAnchor":"middle","textVerticalAnchor":"middle","class":"textLabel"},"labelBody":{"rx":2,"ry":2,"ref":"labelText","x":"calc(x - 3)","y":"calc(y - 3)","width":"calc(w + 6)","height":"calc(h + 6)","fill":"white","stroke":"black","class":"textLabelBody"}}},"connector":{"name":"jumpover"},"smooth":false,"id":"11c4870f-a26b-48f0-8bcf-848d7d197d10","labels":[{"attrs":{"labelText":{"text":"Parallel Reject","title":"Parallel Reject","z":9,"textAnchor":"middle"}},"position":{"distance":0.4}}],"vertices":[],"attrs":{"line":{"stroke":"black","stroke-width":2}}},{"type":"standard.Link","source":{"id":"68a83ac0-f106-4968-8ed7-e832a57c666a","anchor":{"name":"perpendicular","args":{"dx":0,"dy":0}}},"target":{"id":48241,"anchor":{"name":"perpendicular","args":{"dx":0,"dy":0}}},"defaultLabel":{"markup":[{"namespaceURI":"http://www.w3.org/2000/svg","tagName":"rect","style":{},"selector":"labelBody"},{"namespaceURI":"http://www.w3.org/2000/svg","tagName":"text","style":{},"selector":"labelText"}],"attrs":{"labelText":{"fill":"#333","fontSize":12,"fontFamily":"sans-serif","fontWeight":"bold","textAnchor":"middle","textVerticalAnchor":"middle","class":"textLabel"},"labelBody":{"rx":2,"ry":2,"ref":"labelText","x":"calc(x - 3)","y":"calc(y - 3)","width":"calc(w + 6)","height":"calc(h + 6)","fill":"white","stroke":"black","class":"textLabelBody"}}},"connector":{"name":"jumpover"},"smooth":false,"id":"f3c3fbef-ce33-45d2-9552-0f8da19731e0","labels":[{"attrs":{"labelText":{"text":"333333","title":"333333","z":9,"textAnchor":"middle"}},"position":{"distance":0.4}}],"vertices":[{"x":907.5,"y":697}],"attrs":{"line":{"stroke":"black","stroke-width":2}}},{"type":"standard.Link","source":{"id":46272,"anchor":{"name":"perpendicular","args":{"dx":0,"dy":0}}},"target":{"id":"29fe29bf-19ff-4925-9dcd-2aa3885daab0","anchor":{"name":"perpendicular","args":{"dx":0,"dy":0}}},"defaultLabel":{"markup":[{"namespaceURI":"http://www.w3.org/2000/svg","tagName":"rect","style":{},"selector":"labelBody"},{"namespaceURI":"http://www.w3.org/2000/svg","tagName":"text","style":{},"selector":"labelText"}],"attrs":{"labelText":{"fill":"#333","fontSize":12,"fontFamily":"sans-serif","fontWeight":"bold","textAnchor":"middle","textVerticalAnchor":"middle","class":"textLabel"},"labelBody":{"rx":2,"ry":2,"ref":"labelText","x":"calc(x - 3)","y":"calc(y - 3)","width":"calc(w + 6)","height":"calc(h + 6)","fill":"white","stroke":"black","class":"textLabelBody"}}},"connector":{"name":"jumpover"},"smooth":false,"id":"b231c7e7-6a7b-4e00-b2ec-98a3ad791fcd","vertices":[],"attrs":{"line":{"stroke":"black","stroke-width":2}}},{"type":"standard.Link","source":{"id":"29fe29bf-19ff-4925-9dcd-2aa3885daab0","anchor":{"name":"perpendicular","args":{"dx":0,"dy":0}}},"target":{"id":48981,"anchor":{"name":"perpendicular","args":{"dx":0,"dy":0}}},"defaultLabel":{"markup":[{"namespaceURI":"http://www.w3.org/2000/svg","tagName":"rect","style":{},"selector":"labelBody"},{"namespaceURI":"http://www.w3.org/2000/svg","tagName":"text","style":{},"selector":"labelText"}],"attrs":{"labelText":{"fill":"#333","fontSize":12,"fontFamily":"sans-serif","fontWeight":"bold","textAnchor":"middle","textVerticalAnchor":"middle","class":"textLabel"},"labelBody":{"rx":2,"ry":2,"ref":"labelText","x":"calc(x - 3)","y":"calc(y - 3)","width":"calc(w + 6)","height":"calc(h + 6)","fill":"white","stroke":"black","class":"textLabelBody"}}},"connector":{"name":"jumpover"},"smooth":false,"id":"bc6217ea-6361-4ab8-a988-6924ca5245fa","labels":[{"attrs":{"labelText":{"text":"Approve","title":"Approve","z":9,"textAnchor":"middle"}},"position":{"distance":0.4}}],"vertices":[{"x":682.5,"y":697}],"attrs":{"line":{"stroke":"black","stroke-width":2}}},{"type":"standard.Link","source":{"id":"29fe29bf-19ff-4925-9dcd-2aa3885daab0","anchor":{"name":"perpendicular","args":{"dx":0,"dy":0}}},"target":{"id":48241,"anchor":{"name":"perpendicular","args":{"dx":0,"dy":0}}},"defaultLabel":{"markup":[{"namespaceURI":"http://www.w3.org/2000/svg","tagName":"rect","style":{},"selector":"labelBody"},{"namespaceURI":"http://www.w3.org/2000/svg","tagName":"text","style":{},"selector":"labelText"}],"attrs":{"labelText":{"fill":"#333","fontSize":12,"fontFamily":"sans-serif","fontWeight":"bold","textAnchor":"middle","textVerticalAnchor":"middle","class":"textLabel"},"labelBody":{"rx":2,"ry":2,"ref":"labelText","x":"calc(x - 3)","y":"calc(y - 3)","width":"calc(w + 6)","height":"calc(h + 6)","fill":"white","stroke":"black","class":"textLabelBody"}}},"connector":{"name":"jumpover"},"smooth":false,"id":"81913a93-ae8d-4af0-bbdb-76e66ab46c39","labels":[{"attrs":{"labelText":{"text":"GotoRejectButto...","title":"GotoRejectButtonActionLabel","z":9,"textAnchor":"middle"}},"position":{"distance":0.4}}],"vertices":[{"x":1132.5,"y":697}],"attrs":{"line":{"stroke":"black","stroke-width":2}}},{"type":"standard.Link","source":{"id":48981,"anchor":{"name":"perpendicular","args":{"dx":0,"dy":0}}},"target":{"id":46271,"anchor":{"name":"perpendicular","args":{"dx":0,"dy":0}}},"defaultLabel":{"markup":[{"namespaceURI":"http://www.w3.org/2000/svg","tagName":"rect","style":{},"selector":"labelBody"},{"namespaceURI":"http://www.w3.org/2000/svg","tagName":"text","style":{},"selector":"labelText"}],"attrs":{"labelText":{"fill":"#333","fontSize":12,"fontFamily":"sans-serif","fontWeight":"bold","textAnchor":"middle","textVerticalAnchor":"middle","class":"textLabel"},"labelBody":{"rx":2,"ry":2,"ref":"labelText","x":"calc(x - 3)","y":"calc(y - 3)","width":"calc(w + 6)","height":"calc(h + 6)","fill":"white","stroke":"black","class":"textLabelBody"}}},"connector":{"name":"jumpover"},"smooth":false,"id":"b3eee6d0-5f07-44ef-aa0d-277f6c0a7e2d","labels":[{"attrs":{"labelText":{"text":"Parallel Approved","title":"Parallel Approved","z":9,"textAnchor":"middle"}},"position":{"distance":0.4}}],"vertices":[{"x":457.5,"y":887}],"attrs":{"line":{"stroke":"black","stroke-width":2}}},{"type":"standard.Link","source":{"id":46271,"anchor":{"name":"perpendicular","args":{"dx":0,"dy":0}}},"target":{"id":"endNode","anchor":{"name":"center","args":{"dx":0,"dy":0}}},"defaultLabel":{"markup":[{"namespaceURI":"http://www.w3.org/2000/svg","tagName":"rect","style":{},"selector":"labelBody"},{"namespaceURI":"http://www.w3.org/2000/svg","tagName":"text","style":{},"selector":"labelText"}],"attrs":{"labelText":{"fill":"#333","fontSize":12,"fontFamily":"sans-serif","fontWeight":"bold","textAnchor":"middle","textVerticalAnchor":"middle","class":"textLabel"},"labelBody":{"rx":2,"ry":2,"ref":"labelText","x":"calc(x - 3)","y":"calc(y - 3)","width":"calc(w + 6)","height":"calc(h + 6)","fill":"white","stroke":"black","class":"textLabelBody"}}},"connector":{"name":"jumpover"},"smooth":false,"id":"9f8b7892-1dc1-4db7-8e34-028bb2fa2cb0","vertices":[],"attrs":{"line":{"stroke":"black","stroke-width":2}}},{"type":"standard.Link","source":{"id":48241,"anchor":{"name":"perpendicular","args":{"dx":0,"dy":0}}},"target":{"id":"endNode","anchor":{"name":"center","args":{"dx":0,"dy":0}}},"defaultLabel":{"markup":[{"namespaceURI":"http://www.w3.org/2000/svg","tagName":"rect","style":{},"selector":"labelBody"},{"namespaceURI":"http://www.w3.org/2000/svg","tagName":"text","style":{},"selector":"labelText"}],"attrs":{"labelText":{"fill":"#333","fontSize":12,"fontFamily":"sans-serif","fontWeight":"bold","textAnchor":"middle","textVerticalAnchor":"middle","class":"textLabel"},"labelBody":{"rx":2,"ry":2,"ref":"labelText","x":"calc(x - 3)","y":"calc(y - 3)","width":"calc(w + 6)","height":"calc(h + 6)","fill":"white","stroke":"black","class":"textLabelBody"}}},"connector":{"name":"jumpover"},"smooth":false,"id":"0db4f3f2-b42d-4ac8-9cac-3afd7f87706f","vertices":[{"x":907.5,"y":1057}],"attrs":{"line":{"stroke":"black","stroke-width":2}}}]}
  return obj;
}
