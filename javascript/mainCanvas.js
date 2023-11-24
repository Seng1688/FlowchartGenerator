//** Global Variable **//
// destructuring assignment
const { shapes, util, dia, mvc, elementTools } = joint;
const rectWidth = 140;
const rectHeight = 60;
let defaultFontSize = 20;
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
    var paper = this.options.paper;

    // add eventlinstener to the paper's elements
    this.listenTo(paper.model, "change", function (_, opt) {
      if (paper.getContentArea().width !== paper.paperContentW || paper.getContentArea().height !== paper.paperContentH)
        autoResizePaper(paper);
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

    addElementTools(graph.getElements(), paper);

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
    paper.scale(0.8);
    autoResizePaper(mainPaper);
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

// custom elementTool
const ResizeTool = elementTools.Control.extend({
  children: [
    {
      tagName: "image",
      selector: "handle",
      attributes: {
        cursor: "se-resize",
        width: 20,
        height: 20,
        "xlink:href": "picture/resize.png"
      }
    },
    {
      tagName: "rect",
      selector: "extras",
      attributes: {
        "pointer-events": "none",
        fill: "none",
        stroke: "rgb(255, 112, 238)",
        "stroke-width": "3",
        "stroke-dasharray": "10",
        rx: 5,
        ry: 5
      }
    }
  ],
  getPosition: function (view) {
    const model = view.model;
    const { width, height } = model.size();
    return { x: width - 5, y: height - 5 };

  },
  setPosition: function (view, coordinates) {

    const model = view.model;
    model.resize(
      Math.max(coordinates.x, 1),
      Math.max(coordinates.y, 1)
    )

    if (model instanceof ParallelRect) {

      let size = model.attributes.branchSize;
      let rows = model.attributes.rows;
      let columns = model.attributes.columns;
      let bodyW = model.size().width;
      let bodyH = model.size().height;
      let childWidth = (bodyW - (columns+1)*5 ) / columns;
      let childHeight = (bodyH - 24 - (rows+1) *5 ) / rows ;
      let offsetX = 5
      let offsetY = 5;
      let level = 1; // to calculate offsetY for each branch
      let counter = 1; // to calculate offsetX for each branch

      for (let i = 0; i < size; i++) {

        // update level
        if (i != 0 && i % 3 == 0) {
          level++;
        }

        // update counter
        if (counter == 4) {
          counter = 1;
        }

        model.attr(`branch${i + 1}/width`, childWidth);
        model.attr(`branch${i + 1}/height`, childHeight);
        model.attr(`branch${i + 1}/refX`, counter * offsetX + (counter - 1) * childWidth);
        model.attr(`branch${i + 1}/refY`, level * offsetY + (level - 1) * childHeight + 24);

        counter++;
      }

    }

  },
  resetPosition: function (view) {
    // const model = view.model;
    // model instanceof shapes.standard.Rectangle ? model.resize(140, 60) : model.resize(40, 40);
  }
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
        fontSize:defaultFontSize,
        textWrap: {
          width: 'calc(w - 90)', // Adjust the width as needed
          padding: 10,
          height: 28,
          ellipsis: true 
        },
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
      size: { width: 40, height: 40 },
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
      size: { width: 40, height: 40 },
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

    paper.dragStartPosition = false;
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

  const Rect = new shapes.standard.Rectangle({
    id: rectData.currentStageId.toString(),
    size: { width: rectWidth, height: rectHeight },

    attrs: {
      body: {
        fill: fillValue,
        stroke: "black",
        strokeWidth: 1.5,
        title: rectData.currentStageName,
      },

      label: {
        text: rectData.currentStageName,
        fill: "black",
        fontSize: defaultFontSize,
        textWrap: {
          width: 'calc(w - 50)', 
          padding: 10,
          height: '80%',
          ellipsis: true 
        },
      },
    },
    seqNo: rectData.seqNo,
  });
  return Rect;
}

function createParallelRect(rectData) {


  let fullStageName = rectData.currentStageName;

  var parallel = new ParallelRect({
    id: rectData.currentStageId.toString(),
    currentStageName: rectData.currentStageName,
    size: { width: 100, height: 80 },
    attrs: {
      titleLabel: {
        text: fullStageName,
      },
      header: {
        title: fullStageName,
      }
    },
    branchSize: rectData.branches.length,
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

  for (let i = 0; i < parallel.attributes.branchSize; i++) {

    let fullBranchName = rectData.branches[i].branchName;

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
      title: fullBranchName,
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
      text: fullBranchName,
      refX: "50%",
      refY: "50%",
      fontSize: defaultFontSize,
      parallelSet: parallelSet,
      class: "branchLabel",
      textWrap: {
        width: 'calc(w - 20)', 
        padding: 10,
        height: '80%',
        ellipsis: true 
      },
    });
    parallel.markup.push(branchLabelMarkup);

    branchCounter++;
    counter++;
  }

  parallel.attr("icon", {
    id: rectData.currentStageId,
  });

  parallel.attributes.rows = level;
  parallel.attributes.columns = parallel.attributes.branchSize > 3? 3 : parallel.attributes.branchSize

  return parallel;
}

function createPolygon(dataArray, elementsArray) {

  dataArray.forEach((rectData) => {
    let childSize = rectData.nextStages.length;
    let parentId = rectData.currentStageId;
    let seqNo = rectData.seqNo;

    if (childSize > 1) {

      let polygon = new joint.shapes.standard.Polygon({
        size: { width: 40, height: 40 },
        position: { x: 250, y: 210 },
        attrs: {
          root: {
            title: 'joint.shapes.standard.Polygon',
          },
          body: {
            refPoints: '0,10 10,0 20,10 10,20',
          },
        },
        parentId,
        seqNo,
      });

      elementsArray.push(polygon);
    }
  });
}

function createLink(linksArray, source, target, { sourceSide, dx: sourceDx = 0, dy: sourceDy = 0 }, { targetSide, dx: targetDx = 0, dy: targetDy = 0 }, actionLabel = "") {
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
          fontSize: defaultFontSize-4,
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
            title: actionLabel,
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
  createPolygon(rectDataArray, elementsArray);

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

    // check if it has decision and handle it
    if (childSize > 1) {
      let index = elementsArray.findIndex(function (element) {
        return element.attributes.parentId === source;
      });
      let target = elementsArray[index].id;
      createLink(linksArray, source, target, { sourceSide: "perpendicular" }, { targetSide: "perpendicular", targetDx: 0, targetDy: 50 }, "");

      //change the Original Parent to decision polygon after connect Parent to Polygon
      source = target;
    }

    for (let i = 0; i < childSize; i++) {
      target = rectData.nextStages[i].stageId;
      let actionLabel = rectData.nextStages[i].actionName;
      createLink(linksArray, source, target, { sourceSide: "perpendicular" }, { targetSide: "perpendicular", targetDx: 0, targetDy: 0 }, actionLabel);
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

  paper.on("link:mouseover", (linkView, evt) => {
    linkView.showTools();
    evt.stopPropagation();
  })

  paper.on("link:mouseout", (linkView, evt) => {
    linkView.hideTools();
    evt.stopPropagation();
  })

}

function addElementTools(elements, paper) {
  elements.forEach(element => {
    let elementView = paper.findViewByModel(element);
    elementView.addTools(createElementTools());
    elementView.hideTools();
  });

  paper.on("element:pointerclick", (elementView, evt) => {
    let isSelected = elementView.model.attributes.isSelected;
    if (isSelected) {
      elementView.hideTools();
      elementView.model.attributes.isSelected = false;
      evt.stopPropagation();

    }
    else {
      elementView.showTools();
      elementView.model.attributes.isSelected = true;
      evt.stopPropagation();
    }
  })
}

function createElementTools() {


  var boundaryTool = new joint.elementTools.Boundary({
    focusOpacity: 0.5,
    padding: 15,
    useModelGeometry: true
  });


  let resizeTool = new ResizeTool({
    padding: 15,
    selector: "body"
  });

  var elementsView = new joint.dia.ToolsView({
    name: 'element-tools',
    tools: [boundaryTool, resizeTool]
  });

  return elementsView;

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

function downloadPDF(canvas) {

  // Create a jsPDF instance
  let pdf = new jsPDF();
  let pdfWidth = 210; // PDF page width in mm (A4 size)
  let pdfHeight = 297; // PDF page height in mm (A4 size)
  let cw = canvas.width;
  let ch = canvas.height;
  let ratio;

  // Calculate the width and height for the image to fit within the PDF page
  if (cw > ch) {
    ratio = cw / pdfWidth;
  } else {
    ratio = ch / pdfHeight;
  }

  let imgWidth = cw / ratio;
  let imgHeight = ch / ratio;

  pdf.addImage(canvas, 'PNG', 0, 0, imgWidth, imgHeight);
  pdf.save('my-document.pdf');

}

function downloadImage(canvas, fileType) {

  canvas.toBlob(function (blob) {

    // Create a temporary link and trigger a download
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `my-image.${fileType}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(a.href);
    canvas = null;
  }, `image/${fileType}`);
}

function downloadImg(fileType) {

  var targetSvg = document.getElementById('mainPaper');

  // Use HTML2Canvas to capture the SVG element
  html2canvas(targetSvg, { backgroundColor: 'rgba(200, 200, 200, 2000)' }).then(function (canvas) {
    // Convert the canvas to a data URL
    var dataURL = canvas.toDataURL(`image/${fileType}`);

    // Create a temporary link and trigger a download
    var a = document.createElement('a');
    a.href = dataURL;
    a.download = `converted-image.${fileType}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

}

function arrowheadAdjustment() {
  let markers = document.querySelectorAll('marker');

  markers.forEach(marker => {
    if (marker.hasAttribute('refX') && marker.hasAttribute('refY')) {
      marker.removeAttribute('refX', 0);
      marker.removeAttribute('refY', 0);
    }
    else {
      marker.setAttribute('refX', 12);
      marker.setAttribute('refY', 12);
    }
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
    const authToken = "eyJhbGciOiJSUzI1NiIsImtpZCI6IkYzNkI2NDUzQUQ1OEQwQTM0MTRBOTgxMDhGOEE3NkNBIiwidHlwIjoiYXQrand0In0.eyJuYmYiOjE3MDA3OTcwOTAsImV4cCI6MTcwMDgwMDY5MCwiaXNzIjoiaHR0cHM6Ly9xYWxvZ2luLmt1YmUzNjUuY29tIiwiYXVkIjpbIkt1YmUuMzY1LkFwaSIsIkt1YmUuMzY1LkFkbWluLkFwaSJdLCJjbGllbnRfaWQiOiJLdWJlLjM2NS43ZWU3YzE0OC1jMTQ0LTQ2ZWMtYmNhOS1iNzczYWZiYzZmNDUuVUkiLCJzdWIiOiJ5b25nc2VuZy5jaGlhQGlzYXRlYy5jb20iLCJhdXRoX3RpbWUiOjE3MDA3OTMyNjcsImlkcCI6IkZvcm1zIiwianRpIjoiNEU3OUM3NTU1QTVEMzhDQ0M5MzYzNDE5QkE5QUNBNzEiLCJzaWQiOiIzQUY5OUU0NzRBOEJFNTEwM0M2NjEyMkNFNjQxODg3QyIsImlhdCI6MTcwMDc5MzI3MCwic2NvcGUiOlsib3BlbmlkIiwicHJvZmlsZSIsImt1YmUuMzY1LnNjb3BlIiwib2ZmbGluZV9hY2Nlc3MiXSwiYW1yIjpbImV4dGVybmFsIl19.A1iSUQ8sSLu7HcXnUTuFe8XMvvZaBqD6a_LiwH4Hql5KP7C_YaBjpUy_AH6rkjZ1s_oxSZBjzxkkmHIgKM2mnAsGU46ORUUj9M5xKoFKt_xmyaY-MJhHKsTtujuhrobISe1dP_XWslYOP1oz2m-exvzl_6Yozmql56wcRWr_GYxtyai-J55oybeYccVJ9SiGktxfGHCvZpaFN9EdGOPdqi8aY-DvHq8psDzk6wOEqfAyLvWkFlMxhfePes5-Xf_d3qe2q1XFcMSwPNsi24pKqtaeUhiiIA93rB3RNEA_4tyXHTcuX4Cj0kYBkSwzvrCtxxuf4XnsNCGCzg1sWB42pQ"

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

// function callAPI() {
//   processJsonData(getCarWF());
// }


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
  // console.log(workflowStages);
  addNextStageData(workflowStages);
  addPrevStageData(workflowStages)
  addBackToPrevStageData();
}

function addNextStageData(workflowStages) {
  // get nextStage & branches data > push to rectDataArray
  for (let i = 0; i < workflowStages.length; i++) {
    let currentStageName = workflowStages[i].currentStageName;
    let currentStageId = workflowStages[i].currentStageId;
    let nextStages = [];
    let preStages = [];
    let branches = [];
    let hasBackToPrev = false;
    let isEndStage = workflowStages[i].isEndStage;
    let isApprovedStage = workflowStages[i].isApprovedStage;
    let seqNo = workflowStages[i].seqNo;
    let hasDecision = false;
    let stageType = workflowStages[i].stageType;       //"Standard", "RequestorSubmission", "ReturnToRequestor" ,"Parallel"
    let eventType;                                     // "GotoStage" , "BacktoPrevStage"
    let parallelSets = workflowStages[i].parallelSets;
    let parallelCompletes = workflowStages[i].parallelCompletes;

    let actionLength =
      stageType == "Parallel"
        ? workflowStages[i].parallelCompletes.length
        : workflowStages[i].actions.length;

    let branchesLength = workflowStages[i].parallelSets.length;

    // get nextStage data
    for (let j = 0; j < actionLength; j++) {

      let stageName = "";
      let actionName;
      let stageId;

      if (stageType === "Parallel") {
        eventType = workflowStages[i].parallelCompletes[j].actions[0].action;


        if (eventType === "goToStage") {
          stageName = workflowStages[i].parallelCompletes[j].actions[0].stageTitle.key;
          actionName = workflowStages[i].parallelCompletes[j].title.key;
          stageId = workflowStages[i].parallelCompletes[j].actions[0].workflowStageId;
        }

        else if (eventType === "prevStage") {
          stageName = 'dummy';
          actionName = workflowStages[i].parallelCompletes[j].title.key;
          stageId = 'dummy';
          hasBackToPrev = true
        }

      }

      else {
        eventType = workflowStages[i].actions[j].eventLists[0].events[0].eventType;

        // "GotoStage" , "BacktoPrevStage"
        if (eventType === "GotoStage") {
          stageName = workflowStages[i].actions[j].eventLists[0].events[0].stageTitle.title.key;
          actionName = workflowStages[i].actions[j].title.key;
          stageId = workflowStages[i].actions[j].eventLists[0].events[0].workflowStageId;

        }
        else if (eventType === "BacktoPrevStage") {
          stageName = 'dummy';
          actionName = workflowStages[i].actions[j].title.key;
          stageId = 'dummy';
          hasBackToPrev = true
        }
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
      eventType,
      hasDecision,
      branches,
      parallelSets,
      parallelCompletes,
      hasBackToPrev
    });
    // console.log(rectDataArray);
  }
}

function addPrevStageData(workflowStages) {
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

function addBackToPrevStageData() {
  // fill in the 'backToPrevStage' action
  let stages = rectDataArray.filter((data) => {
    return data.hasBackToPrev == true;
  })

  for (let i = 0; i < stages.length; i++) {
    let currentStageId = stages[i].currentStageId;
    let prestages = rectDataArray.filter((data) => { return data.currentStageId === currentStageId; })[0].preStages;
    let dummies = stages[i].nextStages.filter((data) => { return data.stageName === 'dummy'; });

    for (let j = 0; j < dummies.length; j++) {
      let actionName = dummies[j].actionName;

      for (let p = 0; p < prestages.length; p++) {

        let index = rectDataArray.findIndex((data) => data.currentStageId === currentStageId);
        let obj = {
          stageName: prestages[p].preStageName,
          actionName: actionName,
          stageId: prestages[p].preStageId
        };
        rectDataArray[index].nextStages.push(obj);

        //remove all dummy obj
        rectDataArray[index].nextStages = rectDataArray[index].nextStages.filter((data) => { return data.stageName !== 'dummy' });
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
  autoResizePaper(mainPaper);
  // let svgElement = document.querySelector('div#mainPaper>svg');
  // console.log(svgElement.width + '  ' + svgElement.height);
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
generateButton.click()
  ;
const loadButton = document.getElementById("loadButton");
loadButton.addEventListener("change", () => {

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
  fr.readAsText(document.getElementById('loadButton').files[0]);



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

  let string = JSON.stringify(mainGraph.toJSON());
  var blob = new Blob([string], {
    type: "text/plain;charset=utf-8",
  });

  // Create and save the file using the FileWriter library
  saveAs(blob, 'fileName');


});

// the canvas's size will always follow the svg's height and width
const downloadButton = document.getElementById("downloadButton");
downloadButton.addEventListener("click", () => {
  let fileType = $('#downloadOption').val();
  let paperW = $('#mainPaper').width();
  let paperH = $('#mainPaper').height();
  let svgElement = document.querySelector('div#mainPaper>svg');
  let whiteBgd = `<rect id="whiteBgd" width="${paperW}" height="${paperH}" style="fill:white;"> </rect>`;

  svgElement.insertAdjacentHTML('afterbegin', whiteBgd);
  svgElement.setAttribute('width', paperW);
  svgElement.setAttribute('height', paperH);

  var canvas = document.createElement('canvas');
  var context = canvas.getContext('2d');

  // Clear the canvas
  context.clearRect(0, 0, paperW, paperH);


  // Use canvg to render SVG onto the canvas
  arrowheadAdjustment();
  canvg(canvas, new XMLSerializer().serializeToString(svgElement));
  arrowheadAdjustment();

  //make sure image is loaded successfully
  setTimeout(() => {

    switch (fileType) {
      case 'png':
      case 'jpg':
        downloadImage(canvas, fileType); // need adjustment on arrowhead before export image

        // downloadImg(fileType); // can't render transparent
        break;

      case 'pdf':
        downloadPDF(canvas);
        break;
      default:
        break;
    }

    document.getElementById("whiteBgd").remove();
    svgElement.setAttribute('width', '100%');
    svgElement.setAttribute('height', '100%');
  }, 200);

});

function getCarWF() {
  let str = {};
  return str = {
    "scopeActive": 1,
    "statusId": 200,
    "responseData": [
      {
        "workflowId": 215,
        "workflowCode": "CourtesyCarRequestProcess",
        "isActive": true,
        "isPublished": true,
        "isWorkflowPublished": true,
        "formId": 322,
        "settings": {
          "customHistoryVisibility": false,
          "customHistoryItems": []
        },
        "notificationCount": 0,
        "workflowSetting": {
          "workflowVersionId": 810,
          "workflowId": 215,
          "title": "Courtesy Car Request Process",
          "displayName": {
            "key": "Courtesy Car Request Process",
            "type": "custom",
            "values": [
              {
                "language": "en-US",
                "value": "Courtesy Car Request Process"
              }
            ]
          },
          "version": 2,
          "startingCondition": 1,
          "isPublished": false,
          "previewApprovalFlow": {
            "allowPreviewApprovalFlow": true,
            "fields": [
              "var_skipSHLevel",
              "var_skipDPLevel",
              "ddlBranch",
              "ddlDepartment",
              "ddlMake",
              "ddlSeries"
            ],
            "excludeStage": true,
            "excludeStageCodes": [
              "CoutersyCarAmendment",
              "AdditionalInformationEnquiry",
              "FurtherDelegationApproval",
              "ExtensionApproval"
            ]
          }
        },
        "publishStatus": "D",
        "workflowStages": {
          "workflowVersion": {
            "workflowVersionId": 810,
            "version": 0
          },
          "workflowStages": [
            {
              "workflowId": 215,
              "workflowVersionId": 810,
              "workflowStageId": 6331,
              "workflowStageCode": "RequestorSubmission",
              "title": {
                "key": "Requestor Submission",
                "type": "custom",
                "values": [
                  {
                    "language": "en-US",
                    "value": "Requestor Submission"
                  },
                  {
                    "language": "zh-Hans",
                    "value": "申请者提交"
                  },
                  {
                    "language": "id-ID",
                    "value": "Requestor Submission"
                  },
                  {
                    "language": "ms-MY",
                    "value": "Requestor Submission"
                  },
                  {
                    "language": "zh-Hant",
                    "value": "Requestor Submission"
                  },
                  {
                    "language": "th-TH",
                    "value": "การส่งคำขอ"
                  }
                ]
              },
              "displayName": {
                "key": "Requestor Submission",
                "type": "custom",
                "values": [
                  {
                    "language": "en-US",
                    "value": "Requestor Submission"
                  },
                  {
                    "language": "zh-Hans",
                    "value": "申请者提交"
                  },
                  {
                    "language": "id-ID",
                    "value": "Requestor Submission"
                  },
                  {
                    "language": "ms-MY",
                    "value": "Requestor Submission"
                  },
                  {
                    "language": "zh-Hant",
                    "value": "Requestor Submission"
                  },
                  {
                    "language": "th-TH",
                    "value": "การส่งคำขอ"
                  }
                ]
              },
              "stageType": "RequestorSubmission",
              "seqNo": 1,
              "isEndStage": false,
              "isApprovedStage": false,
              "isPublished": true,
              "stageConfig": {
                "stageTypeConfigs": [],
                "isAllowDelegation": false,
                "isAllowDelegationToGroup": false,
                "isAllowRequestorAssignUser": false,
                "hasStageReview": false,
                "options": {
                  "displaySequence": 0,
                  "isAllowComment": false,
                  "isAllowCommentInGeneralComment": false,
                  "isAllowCommentCustomize": false,
                  "isAllowEditOtherFields": false,
                  "isAllowTrigger": false,
                  "isSignatureEnabled": false,
                  "isSavableByApprover": false,
                  "hasNoAssigneeAction": false,
                  "hasSameApproverAction": false,
                  "hasAvoidSkipSameApproverAction": false,
                  "isMandatoryComment": false,
                  "isSignatureMandatory": false,
                  "minCharacter": 0,
                  "customizeComments": [],
                  "approverStages": [],
                  "assignOptionNumber": 0,
                  "skipMyTaskForSameRequestorApprover": false,
                  "runIntegrationSynchronously": false
                }
              },
              "notificationCount": 0,
              "reminderCount": 0,
              "integrationCount": 0,
              "deleteLock": false,
              "requestorSubLock": true,
              "options": {
                "displaySequence": 0,
                "isAllowComment": false,
                "isAllowCommentInGeneralComment": false,
                "isAllowCommentCustomize": false,
                "isAllowEditOtherFields": false,
                "isAllowTrigger": false,
                "isSignatureEnabled": false,
                "isSavableByApprover": false,
                "hasNoAssigneeAction": false,
                "hasSameApproverAction": false,
                "hasAvoidSkipSameApproverAction": false,
                "isMandatoryComment": false,
                "isSignatureMandatory": false,
                "minCharacter": 0,
                "customizeComments": [],
                "approverStages": [],
                "assignOptionNumber": 0,
                "skipMyTaskForSameRequestorApprover": false,
                "runIntegrationSynchronously": false
              },
              "assignedTos": [],
              "readers": [],
              "workflowStageTriggers": [],
              "actions": [
                {
                  "workflowActionId": 7873,
                  "workflowActionCode": "30b7c432-a09f-4828-8b53-06629f88968c",
                  "actionType": "standard",
                  "seqNo": 1,
                  "options": {
                    "buttonName": {
                      "key": "Submit",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": "Submit"
                        },
                        {
                          "language": "zh-Hans",
                          "value": ""
                        },
                        {
                          "language": "zh-Hant",
                          "value": ""
                        },
                        {
                          "language": "th-TH",
                          "value": ""
                        }
                      ]
                    },
                    "buttonColor": "btn-primary",
                    "sequence": "1",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": true,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "deleteLock": true,
                  "eventLists": [
                    {
                      "ruleName": "Rule 1",
                      "assignOption": "OneAssignee",
                      "condition": {
                        "conditionGroups": []
                      },
                      "events": [
                        {
                          "eventType": "GotoStage",
                          "workflowStageId": 6333,
                          "stageTitle": {
                            "workflowStageId": 6333,
                            "title": {
                              "key": "HOS/HOAS/HOCS Approval",
                              "type": "custom",
                              "values": [
                                {
                                  "language": "en-US",
                                  "value": "HOS/HOAS/HOCS Approval"
                                },
                                {
                                  "language": "zh-Hans",
                                  "value": ""
                                },
                                {
                                  "language": "zh-Hant",
                                  "value": ""
                                },
                                {
                                  "language": "th-TH",
                                  "value": ""
                                }
                              ]
                            }
                          },
                          "config": {}
                        }
                      ]
                    }
                  ],
                  "notificationCount": 0,
                  "title": {
                    "key": "Submitted",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Submitted"
                      },
                      {
                        "language": "zh-Hans",
                        "value": ""
                      },
                      {
                        "language": "zh-Hant",
                        "value": ""
                      },
                      {
                        "language": "th-TH",
                        "value": ""
                      }
                    ]
                  }
                }
              ],
              "parallels": [],
              "parallelCompletes": [],
              "parallelDeleteLock": true,
              "parallelSets": [],
              "hasNoStageNotifToAssignee": true
            },
            {
              "workflowId": 215,
              "workflowVersionId": 810,
              "workflowStageId": 6348,
              "workflowStageCode": "CoutersyCarAmendment",
              "title": {
                "key": "Coutersy Car Amendment",
                "type": "custom",
                "values": [
                  {
                    "language": "en-US",
                    "value": "Coutersy Car Amendment"
                  },
                  {
                    "language": "zh-Hans",
                    "value": ""
                  },
                  {
                    "language": "zh-Hant",
                    "value": ""
                  },
                  {
                    "language": "th-TH",
                    "value": ""
                  }
                ]
              },
              "displayName": {
                "key": "Pending Coutersy Car Amendment",
                "type": "custom",
                "values": [
                  {
                    "language": "en-US",
                    "value": "Pending Coutersy Car Amendment"
                  },
                  {
                    "language": "zh-Hans",
                    "value": ""
                  },
                  {
                    "language": "zh-Hant",
                    "value": ""
                  },
                  {
                    "language": "th-TH",
                    "value": ""
                  }
                ]
              },
              "stageType": "Standard",
              "seqNo": 2,
              "isEndStage": false,
              "isApprovedStage": false,
              "isSLA": true,
              "isPublished": true,
              "stageConfig": {
                "stageTypeConfigs": [
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "znVehicleUserDetails",
                    "selectedFieldTypeId": 24,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "txtVehicleUserName",
                    "selectedFieldTypeId": 21,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "txtRelation",
                    "selectedFieldTypeId": 21,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "txtEmail",
                    "selectedFieldTypeId": 21,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "txtNRICNo",
                    "selectedFieldTypeId": 21,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "txtDriversLicenseNo",
                    "selectedFieldTypeId": 21,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "txtContactNoMobile",
                    "selectedFieldTypeId": 21,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "txtCustomerCarReg",
                    "selectedFieldTypeId": 21,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "txtCustomerCarModel",
                    "selectedFieldTypeId": 21,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "ddlRequestReason",
                    "selectedFieldTypeId": 15,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  }
                ],
                "isAllowDelegation": false,
                "isAllowDelegationToGroup": false,
                "isAllowRequestorAssignUser": false,
                "hasStageReview": false,
                "options": {
                  "displaySequence": 0,
                  "isAllowComment": true,
                  "isAllowCommentInGeneralComment": false,
                  "isAllowCommentCustomize": false,
                  "isAllowEditOtherFields": false,
                  "isAllowTrigger": false,
                  "isSignatureEnabled": true,
                  "isSavableByApprover": false,
                  "hasNoAssigneeAction": false,
                  "noAssigneeActionEvents": [],
                  "hasSameApproverAction": false,
                  "hasAvoidSkipSameApproverAction": false,
                  "sameApproverActionEvents": [],
                  "isMandatoryComment": true,
                  "isSignatureMandatory": true,
                  "actionButtons": [
                    "a491dd83-2236-470e-b161-556d4c875936",
                    "032ceb49-1c20-4824-bcdf-182dac23b04d"
                  ],
                  "signatureActionButtons": [
                    "a491dd83-2236-470e-b161-556d4c875936"
                  ],
                  "minCharacter": 5,
                  "customizeComments": [],
                  "approverStages": [],
                  "assignOption": "OneAssignee",
                  "assignOptionNumber": 0,
                  "skipMyTaskForSameRequestorApprover": false,
                  "runIntegrationSynchronously": false
                }
              },
              "notificationCount": 1,
              "reminderCount": 1,
              "integrationCount": 0,
              "deleteLock": false,
              "requestorSubLock": false,
              "options": {
                "displaySequence": 0,
                "isAllowComment": true,
                "isAllowCommentInGeneralComment": false,
                "isAllowCommentCustomize": false,
                "isAllowEditOtherFields": false,
                "isAllowTrigger": false,
                "isSignatureEnabled": true,
                "isSavableByApprover": false,
                "hasNoAssigneeAction": false,
                "noAssigneeActionEvents": [],
                "hasSameApproverAction": false,
                "hasAvoidSkipSameApproverAction": false,
                "sameApproverActionEvents": [],
                "isMandatoryComment": true,
                "isSignatureMandatory": true,
                "actionButtons": [
                  "a491dd83-2236-470e-b161-556d4c875936",
                  "032ceb49-1c20-4824-bcdf-182dac23b04d"
                ],
                "signatureActionButtons": [
                  "a491dd83-2236-470e-b161-556d4c875936"
                ],
                "minCharacter": 5,
                "customizeComments": [],
                "approverStages": [],
                "assignOption": "OneAssignee",
                "assignOptionNumber": 0,
                "skipMyTaskForSameRequestorApprover": false,
                "runIntegrationSynchronously": false
              },
              "assignedTos": [
                {
                  "assignedType": "peoplepicker",
                  "assignedTo": "pplRequestor"
                }
              ],
              "readers": [],
              "workflowStageTriggers": [],
              "workflowStageSLA": {
                "slaDuration": 1,
                "slaThreshold": 0,
                "workingDays": [
                  1,
                  2,
                  3,
                  4,
                  5
                ],
                "workingHoursPerDay": 8
              },
              "actions": [
                {
                  "workflowActionId": 7906,
                  "workflowActionCode": "a491dd83-2236-470e-b161-556d4c875936",
                  "actionType": "standard",
                  "seqNo": 1,
                  "options": {
                    "buttonName": {
                      "key": "Update",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": "Update"
                        },
                        {
                          "language": "zh-Hans",
                          "value": "批准"
                        },
                        {
                          "language": "zh-Hant",
                          "value": "批准"
                        },
                        {
                          "language": "th-TH",
                          "value": "อนุมัติ"
                        }
                      ]
                    },
                    "buttonColor": "btn-primary",
                    "sequence": "1",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": true,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "deleteLock": true,
                  "eventLists": [
                    {
                      "ruleName": "Rule 1",
                      "assignOption": "OneAssignee",
                      "events": [
                        {
                          "eventType": "BacktoPrevStage",
                          "workflowStageId": 0,
                          "config": {}
                        }
                      ]
                    }
                  ],
                  "notificationCount": 0,
                  "title": {
                    "key": "Update",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Update"
                      },
                      {
                        "language": "zh-Hans",
                        "value": "批准"
                      },
                      {
                        "language": "zh-Hant",
                        "value": "批准"
                      },
                      {
                        "language": "th-TH",
                        "value": "อนุมัติ"
                      }
                    ]
                  }
                },
                {
                  "workflowActionId": 7907,
                  "workflowActionCode": "032ceb49-1c20-4824-bcdf-182dac23b04d",
                  "actionType": "standard",
                  "seqNo": 2,
                  "options": {
                    "buttonName": {
                      "key": "Cancel",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": "Cancel"
                        },
                        {
                          "language": "zh-Hans",
                          "value": ""
                        },
                        {
                          "language": "zh-Hant",
                          "value": ""
                        },
                        {
                          "language": "th-TH",
                          "value": ""
                        }
                      ]
                    },
                    "buttonColor": "btn-danger",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": false,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "deleteLock": false,
                  "eventLists": [
                    {
                      "ruleName": "Rule 1",
                      "assignOption": "OneAssignee",
                      "events": [
                        {
                          "eventType": "GotoStage",
                          "workflowStageId": 6339,
                          "stageTitle": {
                            "workflowStageId": 6339,
                            "title": {
                              "key": "Cancelled",
                              "type": "custom",
                              "values": [
                                {
                                  "language": "en-US",
                                  "value": "Cancelled"
                                }
                              ]
                            }
                          },
                          "config": {}
                        }
                      ]
                    }
                  ],
                  "notificationCount": 0,
                  "title": {
                    "key": "Cancel",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Cancel"
                      },
                      {
                        "language": "zh-Hans",
                        "value": ""
                      },
                      {
                        "language": "zh-Hant",
                        "value": ""
                      },
                      {
                        "language": "th-TH",
                        "value": ""
                      }
                    ]
                  }
                }
              ],
              "parallels": [],
              "parallelCompletes": [],
              "parallelDeleteLock": true,
              "parallelSets": [],
              "hasNoStageNotifToAssignee": false
            },
            {
              "workflowId": 215,
              "workflowVersionId": 810,
              "workflowStageId": 6333,
              "workflowStageCode": "HOSHOASHOCSApproval",
              "title": {
                "key": "HOS/HOAS/HOCS Approval",
                "type": "custom",
                "values": [
                  {
                    "language": "en-US",
                    "value": "HOS/HOAS/HOCS Approval"
                  },
                  {
                    "language": "zh-Hans",
                    "value": ""
                  },
                  {
                    "language": "zh-Hant",
                    "value": ""
                  },
                  {
                    "language": "th-TH",
                    "value": ""
                  }
                ]
              },
              "displayName": {
                "key": "Pending HOS/HOAS/HOCS Approval",
                "type": "custom",
                "values": [
                  {
                    "language": "en-US",
                    "value": "Pending HOS/HOAS/HOCS Approval"
                  },
                  {
                    "language": "zh-Hans",
                    "value": ""
                  },
                  {
                    "language": "zh-Hant",
                    "value": ""
                  },
                  {
                    "language": "th-TH",
                    "value": ""
                  }
                ]
              },
              "stageType": "Standard",
              "seqNo": 3,
              "isEndStage": false,
              "isApprovedStage": false,
              "isSLA": true,
              "isPublished": true,
              "stageConfig": {
                "stageTypeConfigs": [
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "znReassignment",
                    "selectedFieldTypeId": 24,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "pplReassignTo",
                    "selectedFieldTypeId": 13,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  }
                ],
                "isAllowDelegation": false,
                "isAllowDelegationToGroup": false,
                "isAllowRequestorAssignUser": false,
                "hasStageReview": false,
                "options": {
                  "displaySequence": 0,
                  "isAllowComment": true,
                  "isAllowCommentInGeneralComment": false,
                  "isAllowCommentCustomize": false,
                  "isAllowEditOtherFields": false,
                  "isAllowTrigger": true,
                  "isSignatureEnabled": true,
                  "isSavableByApprover": false,
                  "hasNoAssigneeAction": true,
                  "noAssigneeActionEvents": [
                    {
                      "eventType": "GotoStage",
                      "workflowStageId": 6340
                    }
                  ],
                  "hasSameApproverAction": false,
                  "hasAvoidSkipSameApproverAction": false,
                  "sameApproverActionEvents": [],
                  "isMandatoryComment": true,
                  "isSignatureMandatory": true,
                  "actionButtons": [
                    "ac630e33-876a-48c4-bb6e-b2f3a1692477",
                    "4c6236fc-5062-4198-b11b-ee1444d01bb7",
                    "41e1b5b3-2117-47bb-846f-c7d271931df9"
                  ],
                  "signatureActionButtons": [
                    "937d30a7-55c4-4631-90b7-d36e193e4a89"
                  ],
                  "minCharacter": 5,
                  "customizeComments": [],
                  "approverStages": [],
                  "assignOption": "OneAssignee",
                  "assignOptionNumber": 0,
                  "skipMyTaskForSameRequestorApprover": false,
                  "runIntegrationSynchronously": false
                }
              },
              "notificationCount": 1,
              "reminderCount": 1,
              "integrationCount": 1,
              "deleteLock": false,
              "requestorSubLock": false,
              "options": {
                "displaySequence": 0,
                "isAllowComment": true,
                "isAllowCommentInGeneralComment": false,
                "isAllowCommentCustomize": false,
                "isAllowEditOtherFields": false,
                "isAllowTrigger": true,
                "isSignatureEnabled": true,
                "isSavableByApprover": false,
                "hasNoAssigneeAction": true,
                "noAssigneeActionEvents": [
                  {
                    "eventType": "GotoStage",
                    "workflowStageId": 6340
                  }
                ],
                "hasSameApproverAction": false,
                "hasAvoidSkipSameApproverAction": false,
                "sameApproverActionEvents": [],
                "isMandatoryComment": true,
                "isSignatureMandatory": true,
                "actionButtons": [
                  "ac630e33-876a-48c4-bb6e-b2f3a1692477",
                  "4c6236fc-5062-4198-b11b-ee1444d01bb7",
                  "41e1b5b3-2117-47bb-846f-c7d271931df9"
                ],
                "signatureActionButtons": [
                  "937d30a7-55c4-4631-90b7-d36e193e4a89"
                ],
                "minCharacter": 5,
                "customizeComments": [],
                "approverStages": [],
                "assignOption": "OneAssignee",
                "assignOptionNumber": 0,
                "skipMyTaskForSameRequestorApprover": false,
                "runIntegrationSynchronously": false
              },
              "assignedTos": [
                {
                  "assignedType": "matrix",
                  "assignedTo": "{\"selectedMatrixId\":49,\"selectedMatrix\":\"ABRBranchApprover\",\"matrixApprover\":[\"SectionHeads\"],\"matrixConditions\":[{\"matrixColumnId\":220,\"matrixField\":\"BranchDescription\",\"columnType\":\"text\",\"type\":\"field\",\"value\":\"ddlBranch\",\"valueFrom\":\"\"},{\"matrixColumnId\":308,\"matrixField\":\"BranchSegment\",\"columnType\":\"text\",\"type\":\"field\",\"value\":\"txtBranchSegment\",\"valueFrom\":\"\"},{\"matrixColumnId\":347,\"matrixField\":\"BranchMake\",\"columnType\":\"text\",\"type\":\"field\",\"value\":\"ddlMake\",\"valueFrom\":\"\"}]}"
                }
              ],
              "readers": [],
              "workflowStageTriggers": [
                {
                  "actionType": "Update",
                  "formIds": [],
                  "formIdRefFields": [
                    "luChassisNo"
                  ],
                  "ownerType": "SubmissionField",
                  "ownerFieldCode": "sysSubmittedBy",
                  "options": {
                    "isCopyFormAccess": true
                  },
                  "fields": [
                    {
                      "fieldCodeFrom": "ddlCarReserved",
                      "fromFieldTypeId": 15,
                      "fieldCodeTo": "ddlCarStatus",
                      "toFieldTypeId": 15,
                      "fieldValueType": "field",
                      "isInTable": false
                    }
                  ],
                  "tableFields": []
                }
              ],
              "workflowStageSLA": {
                "slaDuration": 1,
                "slaThreshold": 0,
                "workingDays": [
                  1,
                  2,
                  3,
                  4,
                  5
                ],
                "workingHoursPerDay": 8
              },
              "actions": [
                {
                  "workflowActionId": 7874,
                  "workflowActionCode": "937d30a7-55c4-4631-90b7-d36e193e4a89",
                  "actionType": "standard",
                  "seqNo": 1,
                  "options": {
                    "buttonName": {
                      "key": "Approve",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": ""
                        }
                      ]
                    },
                    "buttonColor": "btn-primary",
                    "sequence": "1",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": true,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "deleteLock": true,
                  "eventLists": [
                    {
                      "ruleName": "Rule 1",
                      "assignOption": "OneAssignee",
                      "events": [
                        {
                          "eventType": "GotoStage",
                          "workflowStageId": 6334,
                          "stageTitle": {
                            "workflowStageId": 6334,
                            "title": {
                              "key": "DP Approval",
                              "type": "custom",
                              "values": [
                                {
                                  "language": "en-US",
                                  "value": "DP Approval"
                                },
                                {
                                  "language": "zh-Hans",
                                  "value": ""
                                },
                                {
                                  "language": "zh-Hant",
                                  "value": ""
                                },
                                {
                                  "language": "th-TH",
                                  "value": ""
                                }
                              ]
                            }
                          },
                          "config": {}
                        }
                      ]
                    }
                  ],
                  "notificationCount": 0,
                  "title": {
                    "key": "Approve",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": ""
                      }
                    ]
                  }
                },
                {
                  "workflowActionId": 7875,
                  "workflowActionCode": "ac630e33-876a-48c4-bb6e-b2f3a1692477",
                  "actionType": "standard",
                  "seqNo": 2,
                  "options": {
                    "buttonName": {
                      "key": "Reassignment",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": "Reassignment"
                        },
                        {
                          "language": "zh-Hans",
                          "value": ""
                        },
                        {
                          "language": "zh-Hant",
                          "value": ""
                        },
                        {
                          "language": "th-TH",
                          "value": ""
                        }
                      ]
                    },
                    "buttonColor": "btn-info",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": false,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": true,
                    "fieldValidationGroups": [
                      {
                        "validations": [
                          {
                            "validationType": "mandatory",
                            "fieldCode": "pplReassignTo"
                          }
                        ]
                      }
                    ],
                    "workflowActionId": 0
                  },
                  "deleteLock": false,
                  "eventLists": [
                    {
                      "ruleName": "Rule 1",
                      "assignOption": "OneAssignee",
                      "events": [
                        {
                          "eventType": "GotoStage",
                          "workflowStageId": 6336,
                          "stageTitle": {
                            "workflowStageId": 6336,
                            "title": {
                              "key": "Additional Information Enquiry",
                              "type": "custom",
                              "values": [
                                {
                                  "language": "en-US",
                                  "value": "Additional Information Enquiry"
                                },
                                {
                                  "language": "zh-Hans",
                                  "value": ""
                                },
                                {
                                  "language": "zh-Hant",
                                  "value": ""
                                },
                                {
                                  "language": "th-TH",
                                  "value": ""
                                }
                              ]
                            }
                          },
                          "config": {}
                        },
                        {
                          "eventType": "SetValue",
                          "workflowStageId": 0,
                          "config": {
                            "fieldCode": "var_isReassignment",
                            "fieldValue": {
                              "value": "true"
                            }
                          }
                        }
                      ]
                    }
                  ],
                  "notificationCount": 0,
                  "title": {
                    "key": "Reassignment",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Reassignment"
                      },
                      {
                        "language": "zh-Hans",
                        "value": ""
                      },
                      {
                        "language": "zh-Hant",
                        "value": ""
                      },
                      {
                        "language": "th-TH",
                        "value": ""
                      }
                    ]
                  }
                },
                {
                  "workflowActionId": 7876,
                  "workflowActionCode": "4c6236fc-5062-4198-b11b-ee1444d01bb7",
                  "actionType": "standard",
                  "seqNo": 3,
                  "options": {
                    "buttonName": {
                      "key": "Return to Requestor",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": "Return to Requestor"
                        },
                        {
                          "language": "zh-Hans",
                          "value": ""
                        },
                        {
                          "language": "zh-Hant",
                          "value": ""
                        },
                        {
                          "language": "th-TH",
                          "value": ""
                        }
                      ]
                    },
                    "buttonColor": "btn-warning",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": false,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "deleteLock": false,
                  "eventLists": [
                    {
                      "ruleName": "Rule 1",
                      "assignOption": "OneAssignee",
                      "events": [
                        {
                          "eventType": "GotoStage",
                          "workflowStageId": 6348,
                          "stageTitle": {
                            "workflowStageId": 6348,
                            "title": {
                              "key": "Coutersy Car Amendment",
                              "type": "custom",
                              "values": [
                                {
                                  "language": "en-US",
                                  "value": "Coutersy Car Amendment"
                                },
                                {
                                  "language": "zh-Hans",
                                  "value": ""
                                },
                                {
                                  "language": "zh-Hant",
                                  "value": ""
                                },
                                {
                                  "language": "th-TH",
                                  "value": ""
                                }
                              ]
                            }
                          },
                          "config": {}
                        }
                      ]
                    }
                  ],
                  "notificationCount": 0,
                  "title": {
                    "key": "Return to Requestor",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Return to Requestor"
                      },
                      {
                        "language": "zh-Hans",
                        "value": ""
                      },
                      {
                        "language": "zh-Hant",
                        "value": ""
                      },
                      {
                        "language": "th-TH",
                        "value": ""
                      }
                    ]
                  }
                },
                {
                  "workflowActionId": 7877,
                  "workflowActionCode": "41e1b5b3-2117-47bb-846f-c7d271931df9",
                  "actionType": "standard",
                  "seqNo": 4,
                  "options": {
                    "buttonName": {
                      "key": "Reject",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": "Reject"
                        },
                        {
                          "language": "zh-Hans",
                          "value": ""
                        },
                        {
                          "language": "zh-Hant",
                          "value": ""
                        },
                        {
                          "language": "th-TH",
                          "value": ""
                        }
                      ]
                    },
                    "buttonColor": "btn-danger",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": false,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "deleteLock": false,
                  "eventLists": [
                    {
                      "ruleName": "Rule 1",
                      "assignOption": "OneAssignee",
                      "events": [
                        {
                          "eventType": "GotoStage",
                          "workflowStageId": 6338,
                          "stageTitle": {
                            "workflowStageId": 6338,
                            "title": {
                              "key": "Rejected",
                              "type": "custom",
                              "values": [
                                {
                                  "language": "en-US",
                                  "value": "Rejected"
                                }
                              ]
                            }
                          },
                          "config": {}
                        },
                        {
                          "eventType": "SetValue",
                          "workflowStageId": 0,
                          "config": {
                            "fieldCode": "ddlCarStatus",
                            "fieldValue": {
                              "value": "Available"
                            }
                          }
                        }
                      ]
                    }
                  ],
                  "notificationCount": 0,
                  "title": {
                    "key": "Reject",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Reject"
                      },
                      {
                        "language": "zh-Hans",
                        "value": ""
                      },
                      {
                        "language": "zh-Hant",
                        "value": ""
                      },
                      {
                        "language": "th-TH",
                        "value": ""
                      }
                    ]
                  }
                },
                {
                  "workflowActionId": 7878,
                  "workflowActionCode": "253165ad-1a40-4c22-b86d-b6de1effb814",
                  "actionType": "skipstage",
                  "seqNo": 5,
                  "options": {
                    "buttonName": {
                      "key": "Skip HOS/HOAS/HOCS Approval",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": "Skip HOS/HOAS/HOCS Approval"
                        },
                        {
                          "language": "zh-Hans",
                          "value": ""
                        },
                        {
                          "language": "zh-Hant",
                          "value": ""
                        },
                        {
                          "language": "th-TH",
                          "value": ""
                        }
                      ]
                    },
                    "buttonColor": "btn-lightgrey",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": false,
                    "condition": {
                      "conditionGroups": [
                        {
                          "conditions": [
                            {
                              "fieldCode": "var_skipSHLevel",
                              "operator": "=",
                              "fieldValue": {
                                "numberValue": 1.0
                              }
                            }
                          ]
                        }
                      ]
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "deleteLock": false,
                  "eventLists": [
                    {
                      "ruleName": "Rule 1",
                      "assignOption": "OneAssignee",
                      "events": [
                        {
                          "eventType": "GotoStage",
                          "workflowStageId": 6334,
                          "stageTitle": {
                            "workflowStageId": 6334,
                            "title": {
                              "key": "DP Approval",
                              "type": "custom",
                              "values": [
                                {
                                  "language": "en-US",
                                  "value": "DP Approval"
                                },
                                {
                                  "language": "zh-Hans",
                                  "value": ""
                                },
                                {
                                  "language": "zh-Hant",
                                  "value": ""
                                },
                                {
                                  "language": "th-TH",
                                  "value": ""
                                }
                              ]
                            }
                          },
                          "config": {}
                        }
                      ]
                    }
                  ],
                  "notificationCount": 0,
                  "title": {
                    "key": "Skip HOS/HOAS/HOCS Approval",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Skip HOS/HOAS/HOCS Approval"
                      },
                      {
                        "language": "zh-Hans",
                        "value": ""
                      },
                      {
                        "language": "zh-Hant",
                        "value": ""
                      },
                      {
                        "language": "th-TH",
                        "value": ""
                      }
                    ]
                  }
                }
              ],
              "parallels": [],
              "parallelCompletes": [],
              "parallelDeleteLock": true,
              "parallelSets": [],
              "hasNoStageNotifToAssignee": false
            },
            {
              "workflowId": 215,
              "workflowVersionId": 810,
              "workflowStageId": 6340,
              "workflowStageCode": "InvalidLOA",
              "title": {
                "key": "Incomplete LOA Series Setup",
                "type": "custom",
                "values": [
                  {
                    "language": "en-US",
                    "value": "Incomplete LOA Series Setup"
                  },
                  {
                    "language": "zh-Hans",
                    "value": ""
                  },
                  {
                    "language": "zh-Hant",
                    "value": ""
                  },
                  {
                    "language": "th-TH",
                    "value": ""
                  }
                ]
              },
              "displayName": {
                "key": "Pending LOA Series Setup",
                "type": "custom",
                "values": [
                  {
                    "language": "en-US",
                    "value": "Pending LOA Series Setup"
                  },
                  {
                    "language": "zh-Hans",
                    "value": ""
                  },
                  {
                    "language": "zh-Hant",
                    "value": ""
                  },
                  {
                    "language": "th-TH",
                    "value": ""
                  }
                ]
              },
              "stageType": "Standard",
              "seqNo": 4,
              "isEndStage": false,
              "isApprovedStage": false,
              "isSLA": false,
              "isPublished": true,
              "stageConfig": {
                "stageTypeConfigs": [
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "ddlBranch",
                    "selectedFieldTypeId": 15,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "ddlDepartment",
                    "selectedFieldTypeId": 15,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "txtVehicleUserName",
                    "selectedFieldTypeId": 21,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "txtRelation",
                    "selectedFieldTypeId": 21,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "txtEmail",
                    "selectedFieldTypeId": 21,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "txtNRICNo",
                    "selectedFieldTypeId": 21,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "txtDriversLicenseNo",
                    "selectedFieldTypeId": 21,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "txtContactNoMobile",
                    "selectedFieldTypeId": 21,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "txtCustomerCarReg",
                    "selectedFieldTypeId": 21,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "txtCustomerCarModel",
                    "selectedFieldTypeId": 21,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "calRequestedLoanFrom",
                    "selectedFieldTypeId": 1,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "calRequestedLoanTo",
                    "selectedFieldTypeId": 1,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "ddlRequestReason",
                    "selectedFieldTypeId": 15,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "luChassisNo",
                    "selectedFieldTypeId": 11,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  }
                ],
                "isAllowDelegation": false,
                "isAllowDelegationToGroup": false,
                "isAllowRequestorAssignUser": false,
                "hasStageReview": false,
                "options": {
                  "displaySequence": 0,
                  "isAllowComment": true,
                  "isAllowCommentInGeneralComment": false,
                  "isAllowCommentCustomize": false,
                  "isAllowEditOtherFields": false,
                  "isAllowTrigger": false,
                  "isSignatureEnabled": false,
                  "isSavableByApprover": false,
                  "hasNoAssigneeAction": false,
                  "noAssigneeActionEvents": [],
                  "hasSameApproverAction": false,
                  "hasAvoidSkipSameApproverAction": false,
                  "sameApproverActionEvents": [],
                  "isMandatoryComment": true,
                  "isSignatureMandatory": false,
                  "actionButtons": [
                    "4081ad2c-6807-4aef-b837-e4e22611be3b"
                  ],
                  "signatureActionButtons": [],
                  "minCharacter": 5,
                  "customizeComments": [],
                  "approverStages": [],
                  "assignOption": "OneAssignee",
                  "assignOptionNumber": 0,
                  "skipMyTaskForSameRequestorApprover": false,
                  "runIntegrationSynchronously": false
                }
              },
              "notificationCount": 1,
              "reminderCount": 0,
              "integrationCount": 0,
              "deleteLock": false,
              "requestorSubLock": false,
              "options": {
                "displaySequence": 0,
                "isAllowComment": true,
                "isAllowCommentInGeneralComment": false,
                "isAllowCommentCustomize": false,
                "isAllowEditOtherFields": false,
                "isAllowTrigger": false,
                "isSignatureEnabled": false,
                "isSavableByApprover": false,
                "hasNoAssigneeAction": false,
                "noAssigneeActionEvents": [],
                "hasSameApproverAction": false,
                "hasAvoidSkipSameApproverAction": false,
                "sameApproverActionEvents": [],
                "isMandatoryComment": true,
                "isSignatureMandatory": false,
                "actionButtons": [
                  "4081ad2c-6807-4aef-b837-e4e22611be3b"
                ],
                "signatureActionButtons": [],
                "minCharacter": 5,
                "customizeComments": [],
                "approverStages": [],
                "assignOption": "OneAssignee",
                "assignOptionNumber": 0,
                "skipMyTaskForSameRequestorApprover": false,
                "runIntegrationSynchronously": false
              },
              "assignedTos": [
                {
                  "assignedType": "peoplepicker",
                  "assignedTo": "pplRequestor"
                }
              ],
              "readers": [],
              "workflowStageTriggers": [],
              "workflowStageSLA": {
                "slaDuration": 0,
                "slaThreshold": 0,
                "workingDays": [],
                "workingHoursPerDay": 0
              },
              "actions": [
                {
                  "workflowActionId": 7893,
                  "workflowActionCode": "215bdb98-6e4f-48b1-9a85-c0591316c834",
                  "actionType": "standard",
                  "seqNo": 1,
                  "options": {
                    "buttonName": {
                      "key": "Update",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": "Update"
                        }
                      ]
                    },
                    "buttonColor": "btn-primary",
                    "sequence": "1",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": true,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "deleteLock": true,
                  "eventLists": [
                    {
                      "ruleName": "Rule 1",
                      "assignOption": "OneAssignee",
                      "events": [
                        {
                          "eventType": "GotoStage",
                          "workflowStageId": 6333,
                          "stageTitle": {
                            "workflowStageId": 6333,
                            "title": {
                              "key": "HOS/HOAS/HOCS Approval",
                              "type": "custom",
                              "values": [
                                {
                                  "language": "en-US",
                                  "value": "HOS/HOAS/HOCS Approval"
                                },
                                {
                                  "language": "zh-Hans",
                                  "value": ""
                                },
                                {
                                  "language": "zh-Hant",
                                  "value": ""
                                },
                                {
                                  "language": "th-TH",
                                  "value": ""
                                }
                              ]
                            }
                          },
                          "config": {}
                        }
                      ]
                    }
                  ],
                  "notificationCount": 0,
                  "title": {
                    "key": "Update",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Update"
                      }
                    ]
                  }
                },
                {
                  "workflowActionId": 7894,
                  "workflowActionCode": "4081ad2c-6807-4aef-b837-e4e22611be3b",
                  "actionType": "standard",
                  "seqNo": 2,
                  "options": {
                    "buttonName": {
                      "key": "Cancel",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": "Cancel"
                        }
                      ]
                    },
                    "buttonColor": "btn-danger",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": false,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "deleteLock": false,
                  "eventLists": [
                    {
                      "ruleName": "Rule 1",
                      "assignOption": "OneAssignee",
                      "events": [
                        {
                          "eventType": "GotoStage",
                          "workflowStageId": 6339,
                          "stageTitle": {
                            "workflowStageId": 6339,
                            "title": {
                              "key": "Cancelled",
                              "type": "custom",
                              "values": [
                                {
                                  "language": "en-US",
                                  "value": "Cancelled"
                                }
                              ]
                            }
                          },
                          "config": {}
                        }
                      ]
                    }
                  ],
                  "notificationCount": 0,
                  "title": {
                    "key": "Cancel",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Cancel"
                      }
                    ]
                  }
                }
              ],
              "parallels": [],
              "parallelCompletes": [],
              "parallelDeleteLock": true,
              "parallelSets": [],
              "hasNoStageNotifToAssignee": false
            },
            {
              "workflowId": 215,
              "workflowVersionId": 810,
              "workflowStageId": 6334,
              "workflowStageCode": "DPApproval",
              "title": {
                "key": "DP Approval",
                "type": "custom",
                "values": [
                  {
                    "language": "en-US",
                    "value": "DP Approval"
                  },
                  {
                    "language": "zh-Hans",
                    "value": ""
                  },
                  {
                    "language": "zh-Hant",
                    "value": ""
                  },
                  {
                    "language": "th-TH",
                    "value": ""
                  }
                ]
              },
              "displayName": {
                "key": "Pending DP Approval",
                "type": "custom",
                "values": [
                  {
                    "language": "en-US",
                    "value": "Pending DP Approval"
                  },
                  {
                    "language": "zh-Hans",
                    "value": ""
                  },
                  {
                    "language": "zh-Hant",
                    "value": ""
                  },
                  {
                    "language": "th-TH",
                    "value": ""
                  }
                ]
              },
              "stageType": "Standard",
              "seqNo": 5,
              "isEndStage": false,
              "isApprovedStage": false,
              "isSLA": true,
              "isPublished": true,
              "stageConfig": {
                "stageTypeConfigs": [
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "znReassignment",
                    "selectedFieldTypeId": 24,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "pplReassignTo",
                    "selectedFieldTypeId": 13,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "znDelegate",
                    "selectedFieldTypeId": 24,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "pplDelegateto",
                    "selectedFieldTypeId": 13,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  }
                ],
                "isAllowDelegation": false,
                "isAllowDelegationToGroup": false,
                "isAllowRequestorAssignUser": false,
                "hasStageReview": false,
                "options": {
                  "displaySequence": 0,
                  "isAllowComment": true,
                  "isAllowCommentInGeneralComment": false,
                  "isAllowCommentCustomize": false,
                  "isAllowEditOtherFields": false,
                  "isAllowTrigger": false,
                  "isSignatureEnabled": true,
                  "isSavableByApprover": false,
                  "hasNoAssigneeAction": false,
                  "noAssigneeActionEvents": [],
                  "hasSameApproverAction": false,
                  "hasAvoidSkipSameApproverAction": false,
                  "sameApproverActionEvents": [],
                  "isMandatoryComment": true,
                  "isSignatureMandatory": true,
                  "actionButtons": [
                    "3f6d8e87-7ce0-4589-b9f7-96e9513805bc",
                    "435c8917-27e1-4ee9-bc2d-825ca6ec7db2",
                    "ee0c6400-4f7e-4fbd-aa40-f828d764d2f7",
                    "33775cc3-9256-4fce-9321-4525faa9c222"
                  ],
                  "signatureActionButtons": [
                    "7eece5a2-f9cf-480c-926e-0188bfb3df4b"
                  ],
                  "minCharacter": 5,
                  "customizeComments": [],
                  "approverStages": [],
                  "assignOption": "OneAssignee",
                  "assignOptionNumber": 0,
                  "skipMyTaskForSameRequestorApprover": false,
                  "runIntegrationSynchronously": false
                }
              },
              "notificationCount": 1,
              "reminderCount": 1,
              "integrationCount": 0,
              "deleteLock": false,
              "requestorSubLock": false,
              "options": {
                "displaySequence": 0,
                "isAllowComment": true,
                "isAllowCommentInGeneralComment": false,
                "isAllowCommentCustomize": false,
                "isAllowEditOtherFields": false,
                "isAllowTrigger": false,
                "isSignatureEnabled": true,
                "isSavableByApprover": false,
                "hasNoAssigneeAction": false,
                "noAssigneeActionEvents": [],
                "hasSameApproverAction": false,
                "hasAvoidSkipSameApproverAction": false,
                "sameApproverActionEvents": [],
                "isMandatoryComment": true,
                "isSignatureMandatory": true,
                "actionButtons": [
                  "3f6d8e87-7ce0-4589-b9f7-96e9513805bc",
                  "435c8917-27e1-4ee9-bc2d-825ca6ec7db2",
                  "ee0c6400-4f7e-4fbd-aa40-f828d764d2f7",
                  "33775cc3-9256-4fce-9321-4525faa9c222"
                ],
                "signatureActionButtons": [
                  "7eece5a2-f9cf-480c-926e-0188bfb3df4b"
                ],
                "minCharacter": 5,
                "customizeComments": [],
                "approverStages": [],
                "assignOption": "OneAssignee",
                "assignOptionNumber": 0,
                "skipMyTaskForSameRequestorApprover": false,
                "runIntegrationSynchronously": false
              },
              "assignedTos": [
                {
                  "assignedType": "matrix",
                  "assignedTo": "{\"selectedMatrixId\":49,\"selectedMatrix\":\"ABRBranchApprover\",\"matrixApprover\":[\"DP\"],\"matrixConditions\":[{\"matrixColumnId\":220,\"matrixField\":\"BranchDescription\",\"columnType\":\"text\",\"type\":\"field\",\"value\":\"ddlBranch\",\"valueFrom\":\"\"},{\"matrixColumnId\":308,\"matrixField\":\"BranchSegment\",\"columnType\":\"text\",\"type\":\"field\",\"value\":\"txtBranchSegment\",\"valueFrom\":\"\"},{\"matrixColumnId\":347,\"matrixField\":\"BranchMake\",\"columnType\":\"text\",\"type\":\"field\",\"value\":\"ddlMake\",\"valueFrom\":\"\"}]}"
                }
              ],
              "readers": [],
              "workflowStageTriggers": [],
              "workflowStageSLA": {
                "slaDuration": 1,
                "slaThreshold": 0,
                "workingDays": [
                  1,
                  2,
                  3,
                  4,
                  5
                ],
                "workingHoursPerDay": 8
              },
              "actions": [
                {
                  "workflowActionId": 7879,
                  "workflowActionCode": "7eece5a2-f9cf-480c-926e-0188bfb3df4b",
                  "actionType": "standard",
                  "seqNo": 1,
                  "options": {
                    "buttonName": {
                      "key": "Approve",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": ""
                        },
                        {
                          "language": "zh-Hans",
                          "value": ""
                        },
                        {
                          "language": "zh-Hant",
                          "value": ""
                        },
                        {
                          "language": "th-TH",
                          "value": ""
                        }
                      ]
                    },
                    "buttonColor": "btn-primary",
                    "sequence": "1",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": true,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "deleteLock": true,
                  "eventLists": [
                    {
                      "ruleName": "Rule 1",
                      "assignOption": "OneAssignee",
                      "events": [
                        {
                          "eventType": "GotoStage",
                          "workflowStageId": 6347,
                          "stageTitle": {
                            "workflowStageId": 6347,
                            "title": {
                              "key": "Courtesy Car Collection",
                              "type": "custom",
                              "values": [
                                {
                                  "language": "en-US",
                                  "value": "Courtesy Car Collection"
                                }
                              ]
                            }
                          },
                          "config": {}
                        }
                      ]
                    }
                  ],
                  "notificationCount": 0,
                  "title": {
                    "key": "Approve",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": ""
                      },
                      {
                        "language": "zh-Hans",
                        "value": ""
                      },
                      {
                        "language": "zh-Hant",
                        "value": ""
                      },
                      {
                        "language": "th-TH",
                        "value": ""
                      }
                    ]
                  }
                },
                {
                  "workflowActionId": 7880,
                  "workflowActionCode": "3f6d8e87-7ce0-4589-b9f7-96e9513805bc",
                  "actionType": "standard",
                  "seqNo": 2,
                  "options": {
                    "buttonName": {
                      "key": "Reassignment",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": "Reassignment"
                        },
                        {
                          "language": "zh-Hans",
                          "value": ""
                        },
                        {
                          "language": "zh-Hant",
                          "value": ""
                        },
                        {
                          "language": "th-TH",
                          "value": ""
                        }
                      ]
                    },
                    "buttonColor": "btn-info",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": false,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": true,
                    "fieldValidationGroups": [
                      {
                        "validations": [
                          {
                            "validationType": "mandatory",
                            "fieldCode": "pplReassignTo"
                          }
                        ]
                      }
                    ],
                    "workflowActionId": 0
                  },
                  "deleteLock": false,
                  "eventLists": [
                    {
                      "ruleName": "Rule 1",
                      "assignOption": "OneAssignee",
                      "events": [
                        {
                          "eventType": "GotoStage",
                          "workflowStageId": 6336,
                          "stageTitle": {
                            "workflowStageId": 6336,
                            "title": {
                              "key": "Additional Information Enquiry",
                              "type": "custom",
                              "values": [
                                {
                                  "language": "en-US",
                                  "value": "Additional Information Enquiry"
                                },
                                {
                                  "language": "zh-Hans",
                                  "value": ""
                                },
                                {
                                  "language": "zh-Hant",
                                  "value": ""
                                },
                                {
                                  "language": "th-TH",
                                  "value": ""
                                }
                              ]
                            }
                          },
                          "config": {}
                        },
                        {
                          "eventType": "SetValue",
                          "workflowStageId": 0,
                          "config": {
                            "fieldCode": "var_isReassignment",
                            "fieldValue": {
                              "value": "true"
                            }
                          }
                        }
                      ]
                    }
                  ],
                  "notificationCount": 0,
                  "title": {
                    "key": "Reassignment",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Reassignment"
                      },
                      {
                        "language": "zh-Hans",
                        "value": ""
                      },
                      {
                        "language": "zh-Hant",
                        "value": ""
                      },
                      {
                        "language": "th-TH",
                        "value": ""
                      }
                    ]
                  }
                },
                {
                  "workflowActionId": 7881,
                  "workflowActionCode": "435c8917-27e1-4ee9-bc2d-825ca6ec7db2",
                  "actionType": "standard",
                  "seqNo": 3,
                  "options": {
                    "buttonName": {
                      "key": "Delegate ",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": "Delegate "
                        }
                      ]
                    },
                    "buttonColor": "btn-darkgrey",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": false,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": true,
                    "fieldValidationGroups": [
                      {
                        "validations": [
                          {
                            "validationType": "mandatory",
                            "fieldCode": "pplDelegateto"
                          }
                        ]
                      }
                    ],
                    "workflowActionId": 0
                  },
                  "deleteLock": false,
                  "eventLists": [
                    {
                      "ruleName": "Rule 1",
                      "assignOption": "OneAssignee",
                      "events": [
                        {
                          "eventType": "GotoStage",
                          "workflowStageId": 6337,
                          "stageTitle": {
                            "workflowStageId": 6337,
                            "title": {
                              "key": "Further Delegation Approval",
                              "type": "custom",
                              "values": [
                                {
                                  "language": "en-US",
                                  "value": "Further Delegation Approval"
                                },
                                {
                                  "language": "zh-Hans",
                                  "value": ""
                                },
                                {
                                  "language": "zh-Hant",
                                  "value": ""
                                },
                                {
                                  "language": "th-TH",
                                  "value": ""
                                }
                              ]
                            }
                          },
                          "config": {}
                        }
                      ]
                    }
                  ],
                  "notificationCount": 0,
                  "title": {
                    "key": "Delegate ",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Delegate "
                      }
                    ]
                  }
                },
                {
                  "workflowActionId": 7882,
                  "workflowActionCode": "ee0c6400-4f7e-4fbd-aa40-f828d764d2f7",
                  "actionType": "standard",
                  "seqNo": 4,
                  "options": {
                    "buttonName": {
                      "key": "Return to Requestor",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": "Return to Requestor"
                        },
                        {
                          "language": "zh-Hans",
                          "value": ""
                        },
                        {
                          "language": "zh-Hant",
                          "value": ""
                        },
                        {
                          "language": "th-TH",
                          "value": ""
                        }
                      ]
                    },
                    "buttonColor": "btn-warning",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": false,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "deleteLock": false,
                  "eventLists": [
                    {
                      "ruleName": "Rule 1",
                      "assignOption": "OneAssignee",
                      "events": [
                        {
                          "eventType": "GotoStage",
                          "workflowStageId": 6348,
                          "stageTitle": {
                            "workflowStageId": 6348,
                            "title": {
                              "key": "Coutersy Car Amendment",
                              "type": "custom",
                              "values": [
                                {
                                  "language": "en-US",
                                  "value": "Coutersy Car Amendment"
                                },
                                {
                                  "language": "zh-Hans",
                                  "value": ""
                                },
                                {
                                  "language": "zh-Hant",
                                  "value": ""
                                },
                                {
                                  "language": "th-TH",
                                  "value": ""
                                }
                              ]
                            }
                          },
                          "config": {}
                        }
                      ]
                    }
                  ],
                  "notificationCount": 0,
                  "title": {
                    "key": "Return to Requestor",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Return to Requestor"
                      },
                      {
                        "language": "zh-Hans",
                        "value": ""
                      },
                      {
                        "language": "zh-Hant",
                        "value": ""
                      },
                      {
                        "language": "th-TH",
                        "value": ""
                      }
                    ]
                  }
                },
                {
                  "workflowActionId": 7883,
                  "workflowActionCode": "33775cc3-9256-4fce-9321-4525faa9c222",
                  "actionType": "standard",
                  "seqNo": 5,
                  "options": {
                    "buttonName": {
                      "key": "Reject",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": "Reject"
                        }
                      ]
                    },
                    "buttonColor": "btn-danger",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": false,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "deleteLock": false,
                  "eventLists": [
                    {
                      "ruleName": "Rule 1",
                      "assignOption": "OneAssignee",
                      "events": [
                        {
                          "eventType": "GotoStage",
                          "workflowStageId": 6338,
                          "stageTitle": {
                            "workflowStageId": 6338,
                            "title": {
                              "key": "Rejected",
                              "type": "custom",
                              "values": [
                                {
                                  "language": "en-US",
                                  "value": "Rejected"
                                }
                              ]
                            }
                          },
                          "config": {}
                        }
                      ]
                    }
                  ],
                  "notificationCount": 0,
                  "title": {
                    "key": "Reject",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Reject"
                      }
                    ]
                  }
                },
                {
                  "workflowActionId": 7884,
                  "workflowActionCode": "5c7d8951-4073-4a6c-ae69-f22dba2ee139",
                  "actionType": "skipstage",
                  "seqNo": 6,
                  "options": {
                    "buttonName": {
                      "key": "Skip DP Approval",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": "Skip DP Approval"
                        },
                        {
                          "language": "zh-Hans",
                          "value": ""
                        },
                        {
                          "language": "zh-Hant",
                          "value": ""
                        },
                        {
                          "language": "th-TH",
                          "value": ""
                        }
                      ]
                    },
                    "buttonColor": "btn-lightgrey",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": false,
                    "condition": {
                      "conditionGroups": [
                        {
                          "conditions": [
                            {
                              "fieldCode": "var_skipDPLevel",
                              "operator": "=",
                              "fieldValue": {
                                "numberValue": 1.0
                              }
                            },
                            {
                              "fieldCode": "var_skipSHLevel",
                              "operator": "=",
                              "fieldValue": {
                                "numberValue": 0.0
                              }
                            }
                          ]
                        }
                      ]
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "deleteLock": false,
                  "eventLists": [
                    {
                      "ruleName": "Rule 1",
                      "assignOption": "OneAssignee",
                      "events": [
                        {
                          "eventType": "GotoStage",
                          "workflowStageId": 6347,
                          "stageTitle": {
                            "workflowStageId": 6347,
                            "title": {
                              "key": "Courtesy Car Collection",
                              "type": "custom",
                              "values": [
                                {
                                  "language": "en-US",
                                  "value": "Courtesy Car Collection"
                                }
                              ]
                            }
                          },
                          "config": {}
                        }
                      ]
                    }
                  ],
                  "notificationCount": 0,
                  "title": {
                    "key": "Skip DP Approval",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Skip DP Approval"
                      },
                      {
                        "language": "zh-Hans",
                        "value": ""
                      },
                      {
                        "language": "zh-Hant",
                        "value": ""
                      },
                      {
                        "language": "th-TH",
                        "value": ""
                      }
                    ]
                  }
                },
                {
                  "workflowActionId": 7885,
                  "workflowActionCode": "49ebd922-e029-43dd-8aef-11107319678f",
                  "actionType": "skipstage",
                  "seqNo": 7,
                  "options": {
                    "buttonName": {
                      "key": "Validate LOA Approval",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": "Validate LOA Approval"
                        },
                        {
                          "language": "zh-Hans",
                          "value": ""
                        },
                        {
                          "language": "zh-Hant",
                          "value": ""
                        },
                        {
                          "language": "th-TH",
                          "value": ""
                        }
                      ]
                    },
                    "buttonColor": "btn-lightgrey",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": false,
                    "condition": {
                      "conditionGroups": [
                        {
                          "conditions": [
                            {
                              "fieldCode": "var_skipSHLevel",
                              "operator": "=",
                              "fieldValue": {
                                "numberValue": 1.0
                              }
                            },
                            {
                              "fieldCode": "var_skipDPLevel",
                              "operator": "=",
                              "fieldValue": {
                                "numberValue": 1.0
                              }
                            }
                          ]
                        }
                      ]
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "deleteLock": false,
                  "eventLists": [
                    {
                      "ruleName": "Rule 1",
                      "assignOption": "OneAssignee",
                      "events": [
                        {
                          "eventType": "GotoStage",
                          "workflowStageId": 6340,
                          "stageTitle": {
                            "workflowStageId": 6340,
                            "title": {
                              "key": "Incomplete LOA Series Setup",
                              "type": "custom",
                              "values": [
                                {
                                  "language": "en-US",
                                  "value": "Incomplete LOA Series Setup"
                                },
                                {
                                  "language": "zh-Hans",
                                  "value": ""
                                },
                                {
                                  "language": "zh-Hant",
                                  "value": ""
                                },
                                {
                                  "language": "th-TH",
                                  "value": ""
                                }
                              ]
                            }
                          },
                          "config": {}
                        }
                      ]
                    }
                  ],
                  "notificationCount": 0,
                  "title": {
                    "key": "Validate LOA Approval",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Validate LOA Approval"
                      },
                      {
                        "language": "zh-Hans",
                        "value": ""
                      },
                      {
                        "language": "zh-Hant",
                        "value": ""
                      },
                      {
                        "language": "th-TH",
                        "value": ""
                      }
                    ]
                  }
                }
              ],
              "parallels": [],
              "parallelCompletes": [],
              "parallelDeleteLock": true,
              "parallelSets": [],
              "hasNoStageNotifToAssignee": false
            },
            {
              "workflowId": 215,
              "workflowVersionId": 810,
              "workflowStageId": 6347,
              "workflowStageCode": "CourtesyCarCollectionStage",
              "title": {
                "key": "Courtesy Car Collection",
                "type": "custom",
                "values": [
                  {
                    "language": "en-US",
                    "value": "Courtesy Car Collection"
                  }
                ]
              },
              "displayName": {
                "key": "Pending Courtesy Car Collection",
                "type": "custom",
                "values": [
                  {
                    "language": "en-US",
                    "value": "Pending Courtesy Car Collection"
                  }
                ]
              },
              "stageType": "Standard",
              "seqNo": 6,
              "isEndStage": false,
              "isApprovedStage": false,
              "isSLA": true,
              "isPublished": true,
              "stageConfig": {
                "stageTypeConfigs": [
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "znCollectAcknowledge",
                    "selectedFieldTypeId": 24,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "htmlInspectCar",
                    "selectedFieldTypeId": 7,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "htmlCollectCondition",
                    "selectedFieldTypeId": 7,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "tblCollectedItem",
                    "selectedFieldTypeId": 20,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "txtItemChecklistRe",
                    "selectedFieldTypeId": 21,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "ddlFuelLevel",
                    "selectedFieldTypeId": 15,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "taAdditionalInspect",
                    "selectedFieldTypeId": 22,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "calCollectionDate",
                    "selectedFieldTypeId": 1,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "txtCollectedMileage",
                    "selectedFieldTypeId": 21,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "fuICFile",
                    "selectedFieldTypeId": 5,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "fuDrivingLicenseFile",
                    "selectedFieldTypeId": 5,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "fuSupportingDocument",
                    "selectedFieldTypeId": 5,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "signCustomer",
                    "selectedFieldTypeId": 25,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "znOutsideTable",
                    "selectedFieldTypeId": 24,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "tblTnC",
                    "selectedFieldTypeId": 20,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "znOutsideTnC",
                    "selectedFieldTypeId": 24,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "taRules",
                    "selectedFieldTypeId": 22,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "chkAgreement",
                    "selectedFieldTypeId": 3,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "rbPresent",
                    "selectedFieldTypeId": 14,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "chkDisclaimer",
                    "selectedFieldTypeId": 3,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "taRemarks",
                    "selectedFieldTypeId": 22,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "chkDisclaimerCollec",
                    "selectedFieldTypeId": 3,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "txtWitnessName",
                    "selectedFieldTypeId": 21,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "signWitness",
                    "selectedFieldTypeId": 25,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "txtNRICNo",
                    "selectedFieldTypeId": 21,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "txtDriversLicenseNo",
                    "selectedFieldTypeId": 21,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  }
                ],
                "isAllowDelegation": false,
                "isAllowDelegationToGroup": false,
                "isAllowRequestorAssignUser": false,
                "hasStageReview": false,
                "options": {
                  "displaySequence": 0,
                  "isAllowComment": false,
                  "isAllowCommentInGeneralComment": false,
                  "isAllowCommentCustomize": false,
                  "isAllowEditOtherFields": false,
                  "isAllowTrigger": false,
                  "isSignatureEnabled": false,
                  "isSavableByApprover": true,
                  "hasNoAssigneeAction": false,
                  "noAssigneeActionEvents": [],
                  "hasSameApproverAction": false,
                  "hasAvoidSkipSameApproverAction": false,
                  "sameApproverActionEvents": [],
                  "isMandatoryComment": false,
                  "isSignatureMandatory": false,
                  "actionButtons": [],
                  "minCharacter": 0,
                  "customizeComments": [],
                  "approverStages": [],
                  "assignOption": "OneAssignee",
                  "assignOptionNumber": 0,
                  "skipMyTaskForSameRequestorApprover": false,
                  "runIntegrationSynchronously": false
                }
              },
              "notificationCount": 1,
              "reminderCount": 1,
              "integrationCount": 0,
              "deleteLock": false,
              "requestorSubLock": false,
              "options": {
                "displaySequence": 0,
                "isAllowComment": false,
                "isAllowCommentInGeneralComment": false,
                "isAllowCommentCustomize": false,
                "isAllowEditOtherFields": false,
                "isAllowTrigger": false,
                "isSignatureEnabled": false,
                "isSavableByApprover": true,
                "hasNoAssigneeAction": false,
                "noAssigneeActionEvents": [],
                "hasSameApproverAction": false,
                "hasAvoidSkipSameApproverAction": false,
                "sameApproverActionEvents": [],
                "isMandatoryComment": false,
                "isSignatureMandatory": false,
                "actionButtons": [],
                "minCharacter": 0,
                "customizeComments": [],
                "approverStages": [],
                "assignOption": "OneAssignee",
                "assignOptionNumber": 0,
                "skipMyTaskForSameRequestorApprover": false,
                "runIntegrationSynchronously": false
              },
              "assignedTos": [
                {
                  "assignedType": "peoplepicker",
                  "assignedTo": "pplRequestor"
                }
              ],
              "readers": [],
              "workflowStageTriggers": [],
              "workflowStageSLA": {
                "slaDuration": 1,
                "slaThreshold": 0,
                "workingDays": [
                  1,
                  2,
                  3,
                  4,
                  5
                ],
                "workingHoursPerDay": 8
              },
              "actions": [
                {
                  "workflowActionId": 7904,
                  "workflowActionCode": "672d5ef2-f7a9-417b-a5f2-0bb1943dff04",
                  "actionType": "standard",
                  "seqNo": 1,
                  "options": {
                    "buttonName": {
                      "key": "Collect",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": "Collect"
                        }
                      ]
                    },
                    "buttonColor": "btn-primary",
                    "sequence": "1",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": true,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": true,
                    "fieldValidationGroups": [
                      {
                        "validations": [
                          {
                            "validationType": "mandatory",
                            "fieldCode": "chkAgreement"
                          },
                          {
                            "validationType": "mandatory",
                            "fieldCode": "chkDisclaimer"
                          },
                          {
                            "validationType": "mandatory",
                            "fieldCode": "rbPresent"
                          },
                          {
                            "validationType": "mandatory",
                            "fieldCode": "txtFuelLevel"
                          },
                          {
                            "validationType": "mandatory",
                            "fieldCode": "fuICFile"
                          },
                          {
                            "validationType": "mandatory",
                            "fieldCode": "fuDrivingLicenseFile"
                          },
                          {
                            "validationType": "mandatory",
                            "fieldCode": "calCollectionDate"
                          },
                          {
                            "validationType": "mandatory",
                            "fieldCode": "txtCollectedMileage"
                          },
                          {
                            "validationType": "mandatory",
                            "fieldCode": "signCustomer"
                          },
                          {
                            "validationType": "mandatory",
                            "fieldCode": "txtNRICNo"
                          },
                          {
                            "validationType": "mandatory",
                            "fieldCode": "txtDriversLicenseNo"
                          },
                          {
                            "validationType": "mandatory",
                            "fieldCode": "chkDisclaimerCollec"
                          },
                          {
                            "validationType": "mandatory",
                            "fieldCode": "txtWitnessName"
                          },
                          {
                            "validationType": "mandatory",
                            "fieldCode": "signWitness"
                          }
                        ]
                      }
                    ],
                    "workflowActionId": 0
                  },
                  "deleteLock": true,
                  "eventLists": [
                    {
                      "ruleName": "Rule 1",
                      "assignOption": "OneAssignee",
                      "events": [
                        {
                          "eventType": "GotoStage",
                          "workflowStageId": 6341,
                          "stageTitle": {
                            "workflowStageId": 6341,
                            "title": {
                              "key": "Courtesy Car Return",
                              "type": "custom",
                              "values": [
                                {
                                  "language": "en-US",
                                  "value": "Courtesy Car Return"
                                },
                                {
                                  "language": "zh-Hans",
                                  "value": ""
                                },
                                {
                                  "language": "zh-Hant",
                                  "value": ""
                                },
                                {
                                  "language": "th-TH",
                                  "value": ""
                                }
                              ]
                            }
                          },
                          "config": {}
                        },
                        {
                          "eventType": "SetValue",
                          "workflowStageId": 0,
                          "config": {
                            "fieldCode": "rbIsCarReturnStage",
                            "fieldValue": {
                              "value": "True"
                            }
                          }
                        }
                      ]
                    }
                  ],
                  "notificationCount": 0,
                  "title": {
                    "key": "Collect",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Collect"
                      }
                    ]
                  }
                },
                {
                  "workflowActionId": 7905,
                  "workflowActionCode": "4c64be65-3d00-4b36-8880-1af95f7406e6",
                  "actionType": "standard",
                  "seqNo": 2,
                  "options": {
                    "buttonName": {
                      "key": "Reject",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": "Reject"
                        },
                        {
                          "language": "zh-Hans",
                          "value": ""
                        },
                        {
                          "language": "zh-Hant",
                          "value": ""
                        },
                        {
                          "language": "th-TH",
                          "value": ""
                        }
                      ]
                    },
                    "buttonColor": "btn-danger",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": false,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "deleteLock": false,
                  "eventLists": [
                    {
                      "ruleName": "Rule 1",
                      "assignOption": "OneAssignee",
                      "events": [
                        {
                          "eventType": "GotoStage",
                          "workflowStageId": 6338,
                          "stageTitle": {
                            "workflowStageId": 6338,
                            "title": {
                              "key": "Rejected",
                              "type": "custom",
                              "values": [
                                {
                                  "language": "en-US",
                                  "value": "Rejected"
                                }
                              ]
                            }
                          },
                          "config": {}
                        }
                      ]
                    }
                  ],
                  "notificationCount": 0,
                  "title": {
                    "key": "Reject",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Reject"
                      },
                      {
                        "language": "zh-Hans",
                        "value": ""
                      },
                      {
                        "language": "zh-Hant",
                        "value": ""
                      },
                      {
                        "language": "th-TH",
                        "value": ""
                      }
                    ]
                  }
                }
              ],
              "parallels": [],
              "parallelCompletes": [],
              "parallelDeleteLock": true,
              "parallelSets": [],
              "hasNoStageNotifToAssignee": false
            },
            {
              "workflowId": 215,
              "workflowVersionId": 810,
              "workflowStageId": 6341,
              "workflowStageCode": "CourtesyCarReturnParallelStage",
              "title": {
                "key": "Courtesy Car Return",
                "type": "custom",
                "values": [
                  {
                    "language": "en-US",
                    "value": "Courtesy Car Return"
                  },
                  {
                    "language": "zh-Hans",
                    "value": ""
                  },
                  {
                    "language": "zh-Hant",
                    "value": ""
                  },
                  {
                    "language": "th-TH",
                    "value": ""
                  }
                ]
              },
              "displayName": {
                "key": "Pending Courtesy Car Return",
                "type": "custom",
                "values": [
                  {
                    "language": "en-US",
                    "value": "Pending Courtesy Car Return"
                  },
                  {
                    "language": "zh-Hans",
                    "value": ""
                  },
                  {
                    "language": "zh-Hant",
                    "value": ""
                  },
                  {
                    "language": "th-TH",
                    "value": ""
                  }
                ]
              },
              "stageType": "Parallel",
              "seqNo": 7,
              "isEndStage": false,
              "isApprovedStage": false,
              "isSLA": false,
              "isPublished": true,
              "stageConfig": {
                "stageTypeConfigs": [],
                "isAllowDelegation": false,
                "isAllowDelegationToGroup": false,
                "isAllowRequestorAssignUser": false,
                "hasStageReview": false,
                "options": {
                  "displaySequence": 0,
                  "isAllowComment": false,
                  "isAllowCommentInGeneralComment": false,
                  "isAllowCommentCustomize": false,
                  "isAllowEditOtherFields": false,
                  "isAllowTrigger": false,
                  "isSignatureEnabled": false,
                  "isSavableByApprover": false,
                  "hasNoAssigneeAction": false,
                  "noAssigneeActionEvents": [],
                  "hasSameApproverAction": false,
                  "hasAvoidSkipSameApproverAction": false,
                  "sameApproverActionEvents": [],
                  "isMandatoryComment": false,
                  "isSignatureMandatory": false,
                  "actionButtons": [],
                  "minCharacter": 0,
                  "customizeComments": [],
                  "approverStages": [],
                  "assignOption": "OneAssignee",
                  "assignOptionNumber": 0,
                  "skipMyTaskForSameRequestorApprover": false,
                  "runIntegrationSynchronously": false
                }
              },
              "notificationCount": 0,
              "reminderCount": 0,
              "integrationCount": 1,
              "deleteLock": false,
              "requestorSubLock": false,
              "options": {
                "displaySequence": 0,
                "isAllowComment": false,
                "isAllowCommentInGeneralComment": false,
                "isAllowCommentCustomize": false,
                "isAllowEditOtherFields": false,
                "isAllowTrigger": false,
                "isSignatureEnabled": false,
                "isSavableByApprover": false,
                "hasNoAssigneeAction": false,
                "noAssigneeActionEvents": [],
                "hasSameApproverAction": false,
                "hasAvoidSkipSameApproverAction": false,
                "sameApproverActionEvents": [],
                "isMandatoryComment": false,
                "isSignatureMandatory": false,
                "actionButtons": [],
                "minCharacter": 0,
                "customizeComments": [],
                "approverStages": [],
                "assignOption": "OneAssignee",
                "assignOptionNumber": 0,
                "skipMyTaskForSameRequestorApprover": false,
                "runIntegrationSynchronously": false
              },
              "assignedTos": [],
              "readers": [],
              "workflowStageTriggers": [],
              "workflowStageSLA": {
                "slaDuration": 0,
                "slaThreshold": 0,
                "workingDays": [],
                "workingHoursPerDay": 0
              },
              "actions": [
                {
                  "workflowActionId": 7895,
                  "workflowActionCode": "9c136c54-ab04-475e-b830-d30d9624f453",
                  "actionType": "standard",
                  "options": {
                    "buttonName": {
                      "key": "Parallel Approved",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": "Parallel Approved"
                        },
                        {
                          "language": "zh-Hans",
                          "value": "并行批准"
                        },
                        {
                          "language": "id-ID",
                          "value": "Paralel Disetujui"
                        },
                        {
                          "language": "ms-MY",
                          "value": "Selari Diluluskan"
                        },
                        {
                          "language": "zh-Hant",
                          "value": "並行批准"
                        },
                        {
                          "language": "th-TH",
                          "value": "ได้รับการอนุมัติแบบคู่ขนาน"
                        }
                      ]
                    },
                    "buttonColor": "btn-primary",
                    "sequence": "1",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": true,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "deleteLock": true,
                  "eventLists": [],
                  "notificationCount": 0,
                  "title": {
                    "key": "Car Return",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Car Return"
                      },
                      {
                        "language": "zh-Hans",
                        "value": "并行批准"
                      },
                      {
                        "language": "zh-Hant",
                        "value": "並行批准"
                      },
                      {
                        "language": "th-TH",
                        "value": "ได้รับการอนุมัติแบบคู่ขนาน"
                      }
                    ]
                  }
                },
                {
                  "workflowActionId": 7896,
                  "workflowActionCode": "908d5210-c526-4baf-a124-771f1ffefc5c",
                  "actionType": "standard",
                  "options": {
                    "buttonName": {
                      "key": "Parallel Approved",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": "Parallel Approved"
                        },
                        {
                          "language": "zh-Hans",
                          "value": "并行批准"
                        },
                        {
                          "language": "id-ID",
                          "value": "Paralel Disetujui"
                        },
                        {
                          "language": "ms-MY",
                          "value": "Selari Diluluskan"
                        },
                        {
                          "language": "zh-Hant",
                          "value": "並行批准"
                        },
                        {
                          "language": "th-TH",
                          "value": "ได้รับการอนุมัติแบบคู่ขนาน"
                        }
                      ]
                    },
                    "buttonColor": "btn-primary",
                    "sequence": "1",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": true,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "deleteLock": true,
                  "eventLists": [],
                  "notificationCount": 0,
                  "title": {
                    "key": "Parallel Approved",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Parallel Approved"
                      },
                      {
                        "language": "zh-Hans",
                        "value": "并行批准"
                      },
                      {
                        "language": "id-ID",
                        "value": "Paralel Disetujui"
                      },
                      {
                        "language": "ms-MY",
                        "value": "Selari Diluluskan"
                      },
                      {
                        "language": "zh-Hant",
                        "value": "並行批准"
                      },
                      {
                        "language": "th-TH",
                        "value": "ได้รับการอนุมัติแบบคู่ขนาน"
                      }
                    ]
                  }
                },
                {
                  "workflowActionId": 7897,
                  "workflowActionCode": "887122cb-59f3-4613-8f61-0164386dbdb4",
                  "actionType": "standard",
                  "options": {
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": false,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "deleteLock": false,
                  "eventLists": [],
                  "notificationCount": 0,
                  "title": {
                    "key": "Extension Approval",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Extension Approval"
                      },
                      {
                        "language": "zh-Hans",
                        "value": ""
                      },
                      {
                        "language": "zh-Hant",
                        "value": ""
                      },
                      {
                        "language": "th-TH",
                        "value": ""
                      }
                    ]
                  }
                },
                {
                  "workflowActionId": 7898,
                  "workflowActionCode": "11169396-8934-44f3-b62e-5b29285d85cd",
                  "actionType": "standard",
                  "options": {
                    "buttonName": {
                      "key": "Parallel Approved",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": "Parallel Approved"
                        },
                        {
                          "language": "zh-Hans",
                          "value": "并行批准"
                        },
                        {
                          "language": "id-ID",
                          "value": "Paralel Disetujui"
                        },
                        {
                          "language": "ms-MY",
                          "value": "Selari Diluluskan"
                        },
                        {
                          "language": "zh-Hant",
                          "value": "並行批准"
                        },
                        {
                          "language": "th-TH",
                          "value": "ได้รับการอนุมัติแบบคู่ขนาน"
                        }
                      ]
                    },
                    "buttonColor": "btn-primary",
                    "sequence": "1",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": true,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "deleteLock": true,
                  "eventLists": [],
                  "notificationCount": 0,
                  "title": {
                    "key": "Parallel Approved",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Parallel Approved"
                      },
                      {
                        "language": "zh-Hans",
                        "value": "并行批准"
                      },
                      {
                        "language": "id-ID",
                        "value": "Paralel Disetujui"
                      },
                      {
                        "language": "ms-MY",
                        "value": "Selari Diluluskan"
                      },
                      {
                        "language": "zh-Hant",
                        "value": "並行批准"
                      },
                      {
                        "language": "th-TH",
                        "value": "ได้รับการอนุมัติแบบคู่ขนาน"
                      }
                    ]
                  }
                },
                {
                  "workflowActionId": 7899,
                  "workflowActionCode": "eb67da90-d5e1-48a2-ac58-211d90433440",
                  "actionType": "standard",
                  "options": {
                    "buttonName": {
                      "key": "Parallel Approved",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": "Parallel Approved"
                        },
                        {
                          "language": "zh-Hans",
                          "value": "并行批准"
                        },
                        {
                          "language": "id-ID",
                          "value": "Paralel Disetujui"
                        },
                        {
                          "language": "ms-MY",
                          "value": "Selari Diluluskan"
                        },
                        {
                          "language": "zh-Hant",
                          "value": "並行批准"
                        },
                        {
                          "language": "th-TH",
                          "value": "ได้รับการอนุมัติแบบคู่ขนาน"
                        }
                      ]
                    },
                    "buttonColor": "btn-primary",
                    "sequence": "1",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": true,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "deleteLock": true,
                  "eventLists": [],
                  "notificationCount": 0,
                  "title": {
                    "key": "Parallel Approved",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Parallel Approved"
                      },
                      {
                        "language": "zh-Hans",
                        "value": "并行批准"
                      },
                      {
                        "language": "id-ID",
                        "value": "Paralel Disetujui"
                      },
                      {
                        "language": "ms-MY",
                        "value": "Selari Diluluskan"
                      },
                      {
                        "language": "zh-Hant",
                        "value": "並行批准"
                      },
                      {
                        "language": "th-TH",
                        "value": "ได้รับการอนุมัติแบบคู่ขนาน"
                      }
                    ]
                  }
                },
                {
                  "workflowActionId": 7900,
                  "workflowActionCode": "e1c9fcc7-6e92-4513-8fad-3c12631f1597",
                  "actionType": "standard",
                  "options": {
                    "buttonName": {
                      "key": "Parallel Approved",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": "Parallel Approved"
                        },
                        {
                          "language": "zh-Hans",
                          "value": "并行批准"
                        },
                        {
                          "language": "id-ID",
                          "value": "Paralel Disetujui"
                        },
                        {
                          "language": "ms-MY",
                          "value": "Selari Diluluskan"
                        },
                        {
                          "language": "zh-Hant",
                          "value": "並行批准"
                        },
                        {
                          "language": "th-TH",
                          "value": "ได้รับการอนุมัติแบบคู่ขนาน"
                        }
                      ]
                    },
                    "buttonColor": "btn-primary",
                    "sequence": "1",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": true,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "deleteLock": true,
                  "eventLists": [],
                  "notificationCount": 0,
                  "title": {
                    "key": "Parallel Approved",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Parallel Approved"
                      },
                      {
                        "language": "zh-Hans",
                        "value": "并行批准"
                      },
                      {
                        "language": "id-ID",
                        "value": "Paralel Disetujui"
                      },
                      {
                        "language": "ms-MY",
                        "value": "Selari Diluluskan"
                      },
                      {
                        "language": "zh-Hant",
                        "value": "並行批准"
                      },
                      {
                        "language": "th-TH",
                        "value": "ได้รับการอนุมัติแบบคู่ขนาน"
                      }
                    ]
                  }
                }
              ],
              "parallels": [
                {
                  "workflowStageId": 6341
                },
                {
                  "workflowStageId": 6341
                }
              ],
              "parallelCompletes": [
                {
                  "deleteLock": true,
                  "options": {
                    "buttonName": {
                      "key": "Parallel Approved",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": "Parallel Approved"
                        },
                        {
                          "language": "zh-Hans",
                          "value": "并行批准"
                        },
                        {
                          "language": "id-ID",
                          "value": "Paralel Disetujui"
                        },
                        {
                          "language": "ms-MY",
                          "value": "Selari Diluluskan"
                        },
                        {
                          "language": "zh-Hant",
                          "value": "並行批准"
                        },
                        {
                          "language": "th-TH",
                          "value": "ได้รับการอนุมัติแบบคู่ขนาน"
                        }
                      ]
                    },
                    "buttonColor": "btn-primary",
                    "sequence": "1",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": true,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "stageGroups": [
                    {
                      "stages": [
                        {
                          "stageName": {
                            "key": "Courtesy Car Return",
                            "type": "custom",
                            "values": [
                              {
                                "language": "en-US",
                                "value": "Courtesy Car Return"
                              }
                            ]
                          },
                          "actionName": {
                            "key": "Return",
                            "type": "custom",
                            "values": [
                              {
                                "language": "en-US",
                                "value": "Return"
                              }
                            ]
                          },
                          "actionTypeDisplayName": "Any/No Action",
                          "workflowStageId": 6342,
                          "workflowActionId": 7901
                        },
                        {
                          "stageName": {
                            "key": "Customer copy",
                            "type": "custom",
                            "values": [
                              {
                                "language": "en-US",
                                "value": "Customer copy"
                              }
                            ]
                          },
                          "actionName": {
                            "key": "",
                            "type": "custom",
                            "values": []
                          },
                          "actionTypeDisplayName": "Any/No Action",
                          "workflowStageId": 6344,
                          "workflowActionId": 0,
                          "actionType": "AnyOrNoAction"
                        }
                      ],
                      "operator": "All",
                      "evaluateConditionToAllStartedStage": false,
                      "stageParallelCompleteStages": []
                    }
                  ],
                  "actions": [
                    {
                      "stageTitle": {
                        "key": "Completed",
                        "type": "custom",
                        "values": [
                          {
                            "language": "en-US",
                            "value": "Completed"
                          },
                          {
                            "language": "zh-Hans",
                            "value": ""
                          },
                          {
                            "language": "zh-Hant",
                            "value": ""
                          },
                          {
                            "language": "th-TH",
                            "value": ""
                          }
                        ]
                      },
                      "fieldCode": "",
                      "fieldValue": {},
                      "action": "goToStage",
                      "workflowStageId": 6332
                    }
                  ],
                  "workflowStageId": 6341,
                  "workflowActionId": 7895,
                  "seqNo": 1,
                  "title": {
                    "key": "Car Return",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Car Return"
                      },
                      {
                        "language": "zh-Hans",
                        "value": "并行批准"
                      },
                      {
                        "language": "zh-Hant",
                        "value": "並行批准"
                      },
                      {
                        "language": "th-TH",
                        "value": "ได้รับการอนุมัติแบบคู่ขนาน"
                      }
                    ]
                  },
                  "stageParallelCompleteStageGroups": [],
                  "stageParallelCompleteActions": []
                },
                {
                  "deleteLock": false,
                  "options": {
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": false,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "stageGroups": [
                    {
                      "stages": [
                        {
                          "stageName": {
                            "key": "Courtesy Car Return",
                            "type": "custom",
                            "values": [
                              {
                                "language": "en-US",
                                "value": "Courtesy Car Return"
                              }
                            ]
                          },
                          "actionName": {
                            "key": "Extend",
                            "type": "custom",
                            "values": [
                              {
                                "language": "en-US",
                                "value": "Extend"
                              },
                              {
                                "language": "zh-Hans",
                                "value": ""
                              },
                              {
                                "language": "zh-Hant",
                                "value": ""
                              },
                              {
                                "language": "th-TH",
                                "value": ""
                              }
                            ]
                          },
                          "actionTypeDisplayName": "Any/No Action",
                          "workflowStageId": 6342,
                          "workflowActionId": 7902
                        },
                        {
                          "stageName": {
                            "key": "Customer copy",
                            "type": "custom",
                            "values": [
                              {
                                "language": "en-US",
                                "value": "Customer copy"
                              }
                            ]
                          },
                          "actionName": {
                            "key": "",
                            "type": "custom",
                            "values": []
                          },
                          "actionTypeDisplayName": "Any/No Action",
                          "workflowStageId": 6344,
                          "workflowActionId": 0,
                          "actionType": "AnyOrNoAction"
                        }
                      ],
                      "operator": "All",
                      "evaluateConditionToAllStartedStage": false,
                      "stageParallelCompleteStages": []
                    }
                  ],
                  "actions": [
                    {
                      "stageTitle": {
                        "key": "Extension Approval",
                        "type": "custom",
                        "values": [
                          {
                            "language": "en-US",
                            "value": "Extension Approval"
                          },
                          {
                            "language": "zh-Hans",
                            "value": ""
                          },
                          {
                            "language": "zh-Hant",
                            "value": ""
                          },
                          {
                            "language": "th-TH",
                            "value": ""
                          }
                        ]
                      },
                      "fieldCode": "",
                      "fieldValue": {},
                      "action": "goToStage",
                      "workflowStageId": 6335
                    }
                  ],
                  "workflowStageId": 6341,
                  "workflowActionId": 7897,
                  "seqNo": 2,
                  "title": {
                    "key": "Extension Approval",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Extension Approval"
                      },
                      {
                        "language": "zh-Hans",
                        "value": ""
                      },
                      {
                        "language": "zh-Hant",
                        "value": ""
                      },
                      {
                        "language": "th-TH",
                        "value": ""
                      }
                    ]
                  },
                  "stageParallelCompleteStageGroups": [],
                  "stageParallelCompleteActions": []
                }
              ],
              "parallelDeleteLock": false,
              "parallelSets": [
                {
                  "parallelSet": 1,
                  "startingConditions": [
                    {
                      "workflowStageParallelId": 0,
                      "workflowStageId": 6341,
                      "startingCondition": "start",
                      "startingConditionSetting": {
                        "fields": []
                      },
                      "startingStages": [
                        {
                          "title": "{\"key\":\"Courtesy Car Return\",\"type\":\"custom\",\"values\":[{\"language\":\"en-US\",\"value\":\"Courtesy Car Return\"}]}",
                          "workflowStageId": 6342
                        }
                      ]
                    }
                  ],
                  "parallelStages": [
                    {
                      "parallelSet": 1,
                      "workflowId": 215,
                      "workflowVersionId": 810,
                      "workflowStageId": 6342,
                      "workflowStageCode": "CourtesyCarReturnParallelStage1",
                      "title": {
                        "key": "Courtesy Car Return",
                        "type": "custom",
                        "values": [
                          {
                            "language": "en-US",
                            "value": "Courtesy Car Return"
                          }
                        ]
                      },
                      "displayName": {
                        "key": "Pending Courtesy Car Return",
                        "type": "custom",
                        "values": [
                          {
                            "language": "en-US",
                            "value": "Pending Courtesy Car Return"
                          }
                        ]
                      },
                      "stageType": "Standard",
                      "seqNo": 1,
                      "isEndStage": false,
                      "isApprovedStage": false,
                      "isSLA": false,
                      "isPublished": true,
                      "stageConfig": {
                        "stageTypeConfigs": [
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "znReturnAcknowledge",
                            "selectedFieldTypeId": 24,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": true,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "calNewRequestedLoan",
                            "selectedFieldTypeId": 1,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": true,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "taExtensionReason",
                            "selectedFieldTypeId": 22,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "txtExtensionStatus",
                            "selectedFieldTypeId": 21,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "htmlReturnedCon",
                            "selectedFieldTypeId": 7,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": true,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "tblReturnedItem",
                            "selectedFieldTypeId": 20,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "txtItemChecklistRe",
                            "selectedFieldTypeId": 21,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": true,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "ddlFuelLevelRe",
                            "selectedFieldTypeId": 15,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "htmlReturnCondition",
                            "selectedFieldTypeId": 7,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": true,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "taAdditionalNoteRe",
                            "selectedFieldTypeId": 22,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": true,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "calReturnedDateTime",
                            "selectedFieldTypeId": 1,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": true,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "txtReturnedMileage",
                            "selectedFieldTypeId": 21,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "znCollectAcknowledge",
                            "selectedFieldTypeId": 24,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "tblCollectedItem",
                            "selectedFieldTypeId": 20,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "znOutsideTable",
                            "selectedFieldTypeId": 24,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "tblTnC",
                            "selectedFieldTypeId": 20,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "taRules",
                            "selectedFieldTypeId": 22,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "chkAgreement",
                            "selectedFieldTypeId": 3,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "znOutsideTnC",
                            "selectedFieldTypeId": 24,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": true,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "rbReturnOptions",
                            "selectedFieldTypeId": 14,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": true,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "rbPresentRe",
                            "selectedFieldTypeId": 14,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": true,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "chkDisclaimerRe",
                            "selectedFieldTypeId": 3,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": true,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "taRemarksRe",
                            "selectedFieldTypeId": 22,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "chkDisclaimerCollec",
                            "selectedFieldTypeId": 3,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "txtWitnessName",
                            "selectedFieldTypeId": 21,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "signWitness",
                            "selectedFieldTypeId": 25,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": true,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "rbCustomerVehicleRdy",
                            "selectedFieldTypeId": 14,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": true,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "fuGatePass",
                            "selectedFieldTypeId": 5,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "znUploadGatePass",
                            "selectedFieldTypeId": 24,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          }
                        ],
                        "isAllowDelegation": false,
                        "isAllowDelegationToGroup": false,
                        "isAllowRequestorAssignUser": false,
                        "hasStageReview": false,
                        "options": {
                          "displaySequence": 0,
                          "isAllowComment": false,
                          "isAllowCommentInGeneralComment": false,
                          "isAllowCommentCustomize": false,
                          "isAllowEditOtherFields": false,
                          "isAllowTrigger": false,
                          "isSignatureEnabled": false,
                          "isSavableByApprover": true,
                          "hasNoAssigneeAction": false,
                          "noAssigneeActionEvents": [],
                          "hasSameApproverAction": false,
                          "hasAvoidSkipSameApproverAction": false,
                          "sameApproverActionEvents": [],
                          "isMandatoryComment": false,
                          "isSignatureMandatory": false,
                          "minCharacter": 0,
                          "customizeComments": [],
                          "approverStages": [],
                          "assignOption": "OneAssignee",
                          "assignOptionNumber": 0,
                          "skipMyTaskForSameRequestorApprover": false,
                          "runIntegrationSynchronously": false
                        }
                      },
                      "notificationCount": 0,
                      "reminderCount": 1,
                      "integrationCount": 0,
                      "deleteLock": true,
                      "requestorSubLock": false,
                      "options": {
                        "displaySequence": 0,
                        "isAllowComment": false,
                        "isAllowCommentInGeneralComment": false,
                        "isAllowCommentCustomize": false,
                        "isAllowEditOtherFields": false,
                        "isAllowTrigger": false,
                        "isSignatureEnabled": false,
                        "isSavableByApprover": true,
                        "hasNoAssigneeAction": false,
                        "noAssigneeActionEvents": [],
                        "hasSameApproverAction": false,
                        "hasAvoidSkipSameApproverAction": false,
                        "sameApproverActionEvents": [],
                        "isMandatoryComment": false,
                        "isSignatureMandatory": false,
                        "minCharacter": 0,
                        "customizeComments": [],
                        "approverStages": [],
                        "assignOption": "OneAssignee",
                        "assignOptionNumber": 0,
                        "skipMyTaskForSameRequestorApprover": false,
                        "runIntegrationSynchronously": false
                      },
                      "assignedTos": [
                        {
                          "assignedType": "peoplepicker",
                          "assignedTo": "pplRequestor"
                        }
                      ],
                      "readers": [],
                      "workflowStageTriggers": [],
                      "workflowStageSLA": {
                        "slaDuration": 0,
                        "slaThreshold": 0,
                        "workingDays": [],
                        "workingHoursPerDay": 0
                      },
                      "actions": [
                        {
                          "workflowActionId": 7901,
                          "workflowActionCode": "42c1ef2f-cbba-4207-a175-c8916db96fbc",
                          "actionType": "standard",
                          "options": {
                            "buttonName": {
                              "key": "Return",
                              "type": "custom",
                              "values": [
                                {
                                  "language": "en-US",
                                  "value": "Return"
                                }
                              ]
                            },
                            "buttonColor": "btn-primary",
                            "sequence": "1",
                            "seqNo": 0,
                            "conditionalActionEvent": false,
                            "systemAction": true,
                            "condition": {
                              "conditionGroups": []
                            },
                            "allowFieldValidation": true,
                            "fieldValidationGroups": [
                              {
                                "validations": [
                                  {
                                    "validationType": "mandatory",
                                    "fieldCode": "rbReturnOptions"
                                  },
                                  {
                                    "validationType": "mandatory",
                                    "fieldCode": "rbPresentRe"
                                  },
                                  {
                                    "validationType": "mandatory",
                                    "fieldCode": "calReturnedDateTime"
                                  },
                                  {
                                    "validationType": "mandatory",
                                    "fieldCode": "txtReturnedMileage"
                                  }
                                ]
                              }
                            ],
                            "workflowActionId": 0
                          },
                          "deleteLock": true,
                          "eventLists": [
                            {
                              "ruleName": "Rule 1",
                              "assignOption": "OneAssignee",
                              "events": [
                                {
                                  "eventType": "GotoStage",
                                  "workflowStageId": 6343,
                                  "stageTitle": {
                                    "workflowStageId": 6343,
                                    "title": {
                                      "key": "Return",
                                      "type": "custom",
                                      "values": [
                                        {
                                          "language": "en-US",
                                          "value": "Return"
                                        },
                                        {
                                          "language": "zh-Hans",
                                          "value": "已批准"
                                        },
                                        {
                                          "language": "zh-Hant",
                                          "value": "已批准"
                                        },
                                        {
                                          "language": "th-TH",
                                          "value": "ที่ได้รับการอนุมัติ"
                                        }
                                      ]
                                    }
                                  },
                                  "config": {}
                                },
                                {
                                  "eventType": "SetValue",
                                  "workflowStageId": 0,
                                  "config": {
                                    "fieldCode": "rbIsCarReturnStage",
                                    "fieldValue": {
                                      "value": "False"
                                    }
                                  }
                                }
                              ]
                            }
                          ],
                          "notificationCount": 0,
                          "title": {
                            "key": "Return",
                            "type": "custom",
                            "values": [
                              {
                                "language": "en-US",
                                "value": "Return"
                              }
                            ]
                          }
                        },
                        {
                          "workflowActionId": 7902,
                          "workflowActionCode": "2a41704c-8dc3-49ba-abfb-05788d6f6653",
                          "actionType": "standard",
                          "options": {
                            "buttonName": {
                              "key": "Extend",
                              "type": "custom",
                              "values": [
                                {
                                  "language": "en-US",
                                  "value": "Extend"
                                },
                                {
                                  "language": "zh-Hans",
                                  "value": ""
                                },
                                {
                                  "language": "zh-Hant",
                                  "value": ""
                                },
                                {
                                  "language": "th-TH",
                                  "value": ""
                                }
                              ]
                            },
                            "buttonColor": "btn-success",
                            "seqNo": 0,
                            "conditionalActionEvent": false,
                            "systemAction": false,
                            "condition": {
                              "conditionGroups": []
                            },
                            "allowFieldValidation": true,
                            "fieldValidationGroups": [
                              {
                                "validations": [
                                  {
                                    "validationType": "mandatory",
                                    "fieldCode": "rbReturnOptions"
                                  },
                                  {
                                    "validationType": "mandatory",
                                    "fieldCode": "calNewRequestedLoan"
                                  }
                                ]
                              }
                            ],
                            "workflowActionId": 0
                          },
                          "deleteLock": false,
                          "eventLists": [
                            {
                              "ruleName": "Rule 1",
                              "assignOption": "OneAssignee",
                              "events": [
                                {
                                  "eventType": "GotoStage",
                                  "workflowStageId": 6346,
                                  "stageTitle": {
                                    "workflowStageId": 6346,
                                    "title": {
                                      "key": "Extend",
                                      "type": "custom",
                                      "values": [
                                        {
                                          "language": "en-US",
                                          "value": "Extend"
                                        },
                                        {
                                          "language": "zh-Hans",
                                          "value": ""
                                        },
                                        {
                                          "language": "zh-Hant",
                                          "value": ""
                                        },
                                        {
                                          "language": "th-TH",
                                          "value": ""
                                        }
                                      ]
                                    }
                                  },
                                  "config": {}
                                },
                                {
                                  "eventType": "SetValue",
                                  "workflowStageId": 0,
                                  "config": {
                                    "fieldCode": "rbIsCarReturnStage",
                                    "fieldValue": {
                                      "value": "False"
                                    }
                                  }
                                }
                              ]
                            }
                          ],
                          "notificationCount": 0,
                          "title": {
                            "key": "Extend",
                            "type": "custom",
                            "values": [
                              {
                                "language": "en-US",
                                "value": "Extend"
                              },
                              {
                                "language": "zh-Hans",
                                "value": ""
                              },
                              {
                                "language": "zh-Hant",
                                "value": ""
                              },
                              {
                                "language": "th-TH",
                                "value": ""
                              }
                            ]
                          }
                        }
                      ],
                      "parallelWorkflowStageId": 6341,
                      "parallelDeleteLock": false,
                      "hasNoStageNotifToAssignee": true
                    },
                    {
                      "parallelSet": 1,
                      "workflowId": 215,
                      "workflowVersionId": 810,
                      "workflowStageId": 6343,
                      "workflowStageCode": "Return",
                      "title": {
                        "key": "Return",
                        "type": "custom",
                        "values": [
                          {
                            "language": "en-US",
                            "value": "Return"
                          },
                          {
                            "language": "zh-Hans",
                            "value": "已批准"
                          },
                          {
                            "language": "zh-Hant",
                            "value": "已批准"
                          },
                          {
                            "language": "th-TH",
                            "value": "ที่ได้รับการอนุมัติ"
                          }
                        ]
                      },
                      "displayName": {
                        "key": "Return",
                        "type": "custom",
                        "values": [
                          {
                            "language": "en-US",
                            "value": "Return"
                          },
                          {
                            "language": "zh-Hans",
                            "value": "已批准"
                          },
                          {
                            "language": "zh-Hant",
                            "value": "已批准"
                          },
                          {
                            "language": "th-TH",
                            "value": "ที่ได้รับการอนุมัติ"
                          }
                        ]
                      },
                      "stageType": "Standard",
                      "seqNo": 2,
                      "isEndStage": true,
                      "isApprovedStage": true,
                      "isSLA": false,
                      "isPublished": true,
                      "stageConfig": {
                        "stageTypeConfigs": [],
                        "isAllowDelegation": false,
                        "isAllowDelegationToGroup": false,
                        "isAllowRequestorAssignUser": false,
                        "hasStageReview": false,
                        "options": {
                          "displaySequence": 0,
                          "isAllowComment": false,
                          "isAllowCommentInGeneralComment": false,
                          "isAllowCommentCustomize": false,
                          "isAllowEditOtherFields": false,
                          "isAllowTrigger": false,
                          "isSignatureEnabled": false,
                          "isSavableByApprover": false,
                          "hasNoAssigneeAction": false,
                          "noAssigneeActionEvents": [],
                          "hasSameApproverAction": false,
                          "hasAvoidSkipSameApproverAction": false,
                          "sameApproverActionEvents": [],
                          "isMandatoryComment": false,
                          "isSignatureMandatory": false,
                          "minCharacter": 0,
                          "customizeComments": [],
                          "approverStages": [],
                          "assignOptionNumber": 0,
                          "skipMyTaskForSameRequestorApprover": false,
                          "runIntegrationSynchronously": false
                        }
                      },
                      "notificationCount": 0,
                      "reminderCount": 0,
                      "integrationCount": 0,
                      "deleteLock": true,
                      "requestorSubLock": false,
                      "options": {
                        "displaySequence": 0,
                        "isAllowComment": false,
                        "isAllowCommentInGeneralComment": false,
                        "isAllowCommentCustomize": false,
                        "isAllowEditOtherFields": false,
                        "isAllowTrigger": false,
                        "isSignatureEnabled": false,
                        "isSavableByApprover": false,
                        "hasNoAssigneeAction": false,
                        "noAssigneeActionEvents": [],
                        "hasSameApproverAction": false,
                        "hasAvoidSkipSameApproverAction": false,
                        "sameApproverActionEvents": [],
                        "isMandatoryComment": false,
                        "isSignatureMandatory": false,
                        "minCharacter": 0,
                        "customizeComments": [],
                        "approverStages": [],
                        "assignOptionNumber": 0,
                        "skipMyTaskForSameRequestorApprover": false,
                        "runIntegrationSynchronously": false
                      },
                      "assignedTos": [],
                      "readers": [],
                      "workflowStageTriggers": [],
                      "workflowStageSLA": {
                        "slaDuration": 0,
                        "slaThreshold": 0,
                        "workingDays": [],
                        "workingHoursPerDay": 0
                      },
                      "actions": [],
                      "parallelWorkflowStageId": 6341,
                      "parallelDeleteLock": false,
                      "hasNoStageNotifToAssignee": true
                    },
                    {
                      "parallelSet": 1,
                      "workflowId": 215,
                      "workflowVersionId": 810,
                      "workflowStageId": 6346,
                      "workflowStageCode": "Extend",
                      "title": {
                        "key": "Extend",
                        "type": "custom",
                        "values": [
                          {
                            "language": "en-US",
                            "value": "Extend"
                          },
                          {
                            "language": "zh-Hans",
                            "value": ""
                          },
                          {
                            "language": "zh-Hant",
                            "value": ""
                          },
                          {
                            "language": "th-TH",
                            "value": ""
                          }
                        ]
                      },
                      "displayName": {
                        "key": "Extend",
                        "type": "custom",
                        "values": [
                          {
                            "language": "en-US",
                            "value": "Extend"
                          },
                          {
                            "language": "zh-Hans",
                            "value": ""
                          },
                          {
                            "language": "zh-Hant",
                            "value": ""
                          },
                          {
                            "language": "th-TH",
                            "value": ""
                          }
                        ]
                      },
                      "stageType": "Standard",
                      "seqNo": 3,
                      "isEndStage": true,
                      "isApprovedStage": false,
                      "isSLA": false,
                      "isPublished": true,
                      "stageConfig": {
                        "stageTypeConfigs": [],
                        "isAllowDelegation": false,
                        "isAllowDelegationToGroup": false,
                        "isAllowRequestorAssignUser": false,
                        "hasStageReview": false,
                        "options": {
                          "displaySequence": 0,
                          "isAllowComment": false,
                          "isAllowCommentInGeneralComment": false,
                          "isAllowCommentCustomize": false,
                          "isAllowEditOtherFields": false,
                          "isAllowTrigger": false,
                          "isSignatureEnabled": false,
                          "isSavableByApprover": false,
                          "hasNoAssigneeAction": false,
                          "noAssigneeActionEvents": [],
                          "hasSameApproverAction": false,
                          "hasAvoidSkipSameApproverAction": false,
                          "sameApproverActionEvents": [],
                          "isMandatoryComment": false,
                          "isSignatureMandatory": false,
                          "minCharacter": 0,
                          "customizeComments": [],
                          "approverStages": [],
                          "assignOption": "OneAssignee",
                          "assignOptionNumber": 0,
                          "skipMyTaskForSameRequestorApprover": false,
                          "runIntegrationSynchronously": false
                        }
                      },
                      "notificationCount": 0,
                      "reminderCount": 0,
                      "integrationCount": 0,
                      "deleteLock": false,
                      "requestorSubLock": false,
                      "options": {
                        "displaySequence": 0,
                        "isAllowComment": false,
                        "isAllowCommentInGeneralComment": false,
                        "isAllowCommentCustomize": false,
                        "isAllowEditOtherFields": false,
                        "isAllowTrigger": false,
                        "isSignatureEnabled": false,
                        "isSavableByApprover": false,
                        "hasNoAssigneeAction": false,
                        "noAssigneeActionEvents": [],
                        "hasSameApproverAction": false,
                        "hasAvoidSkipSameApproverAction": false,
                        "sameApproverActionEvents": [],
                        "isMandatoryComment": false,
                        "isSignatureMandatory": false,
                        "minCharacter": 0,
                        "customizeComments": [],
                        "approverStages": [],
                        "assignOption": "OneAssignee",
                        "assignOptionNumber": 0,
                        "skipMyTaskForSameRequestorApprover": false,
                        "runIntegrationSynchronously": false
                      },
                      "assignedTos": [],
                      "readers": [],
                      "workflowStageTriggers": [],
                      "workflowStageSLA": {
                        "slaDuration": 0,
                        "slaThreshold": 0,
                        "workingDays": [],
                        "workingHoursPerDay": 0
                      },
                      "actions": [],
                      "parallelWorkflowStageId": 6341,
                      "parallelDeleteLock": false,
                      "hasNoStageNotifToAssignee": true
                    }
                  ]
                },
                {
                  "parallelSet": 2,
                  "startingConditions": [
                    {
                      "workflowStageParallelId": 0,
                      "workflowStageId": 6341,
                      "startingCondition": "start",
                      "startingConditionSetting": {
                        "fields": []
                      },
                      "startingStages": [
                        {
                          "title": "{\"key\":\"Customer copy\",\"type\":\"custom\",\"values\":[{\"language\":\"en-US\",\"value\":\"Customer copy\"}]}",
                          "workflowStageId": 6344
                        }
                      ]
                    }
                  ],
                  "parallelStages": [
                    {
                      "parallelSet": 2,
                      "workflowId": 215,
                      "workflowVersionId": 810,
                      "workflowStageId": 6344,
                      "workflowStageCode": "CoutesyCarParallelCustomerCopyStage",
                      "title": {
                        "key": "Customer copy",
                        "type": "custom",
                        "values": [
                          {
                            "language": "en-US",
                            "value": "Customer copy"
                          }
                        ]
                      },
                      "displayName": {
                        "key": "Customer Copy",
                        "type": "custom",
                        "values": [
                          {
                            "language": "en-US",
                            "value": "Customer Copy"
                          }
                        ]
                      },
                      "stageType": "Standard",
                      "seqNo": 1,
                      "isEndStage": false,
                      "isApprovedStage": false,
                      "isSLA": false,
                      "isPublished": true,
                      "stageConfig": {
                        "stageTypeConfigs": [
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "znReturnAcknowledge",
                            "selectedFieldTypeId": 24,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": true,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "calNewRequestedLoan",
                            "selectedFieldTypeId": 1,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": true,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "taExtensionReason",
                            "selectedFieldTypeId": 22,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "txtExtensionStatus",
                            "selectedFieldTypeId": 21,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "htmlReturnedCon",
                            "selectedFieldTypeId": 7,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": true,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "tblReturnedItem",
                            "selectedFieldTypeId": 20,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "txtItemChecklistRe",
                            "selectedFieldTypeId": 21,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": true,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "ddlFuelLevelRe",
                            "selectedFieldTypeId": 15,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "htmlReturnCondition",
                            "selectedFieldTypeId": 7,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": true,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "taAdditionalNoteRe",
                            "selectedFieldTypeId": 22,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": true,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "calReturnedDateTime",
                            "selectedFieldTypeId": 1,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": true,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "txtReturnedMileage",
                            "selectedFieldTypeId": 21,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "znCollectAcknowledge",
                            "selectedFieldTypeId": 24,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "tblCollectedItem",
                            "selectedFieldTypeId": 20,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "znOutsideTable",
                            "selectedFieldTypeId": 24,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "tblTnC",
                            "selectedFieldTypeId": 20,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "taRules",
                            "selectedFieldTypeId": 22,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "chkAgreement",
                            "selectedFieldTypeId": 3,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "znOutsideTnC",
                            "selectedFieldTypeId": 24,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": true,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "rbPresentRe",
                            "selectedFieldTypeId": 14,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": true,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "chkDisclaimerRe",
                            "selectedFieldTypeId": 3,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": true,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "taRemarksRe",
                            "selectedFieldTypeId": 22,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "chkDisclaimerCollec",
                            "selectedFieldTypeId": 3,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "txtWitnessName",
                            "selectedFieldTypeId": 21,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "signWitness",
                            "selectedFieldTypeId": 25,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          },
                          {
                            "isApproverEditable": false,
                            "isMandatory": false,
                            "isAllowStageApproverEdit": false,
                            "selectedFieldCode": "znUploadGatePass",
                            "selectedFieldTypeId": 24,
                            "approverStages": [],
                            "visibleTo": "Everyone",
                            "isExcludeReader": false,
                            "specificUsers": []
                          }
                        ],
                        "isAllowDelegation": false,
                        "isAllowDelegationToGroup": false,
                        "isAllowRequestorAssignUser": false,
                        "hasStageReview": false,
                        "options": {
                          "displaySequence": 0,
                          "isAllowComment": false,
                          "isAllowCommentInGeneralComment": false,
                          "isAllowCommentCustomize": false,
                          "isAllowEditOtherFields": false,
                          "isAllowTrigger": false,
                          "isSignatureEnabled": false,
                          "isSavableByApprover": false,
                          "hasNoAssigneeAction": false,
                          "noAssigneeActionEvents": [],
                          "hasSameApproverAction": false,
                          "hasAvoidSkipSameApproverAction": false,
                          "sameApproverActionEvents": [],
                          "isMandatoryComment": false,
                          "isSignatureMandatory": false,
                          "minCharacter": 0,
                          "customizeComments": [],
                          "approverStages": [],
                          "assignOption": "OneAssignee",
                          "assignOptionNumber": 0,
                          "skipMyTaskForSameRequestorApprover": false,
                          "runIntegrationSynchronously": false
                        }
                      },
                      "notificationCount": 1,
                      "reminderCount": 0,
                      "integrationCount": 0,
                      "deleteLock": true,
                      "requestorSubLock": false,
                      "options": {
                        "displaySequence": 0,
                        "isAllowComment": false,
                        "isAllowCommentInGeneralComment": false,
                        "isAllowCommentCustomize": false,
                        "isAllowEditOtherFields": false,
                        "isAllowTrigger": false,
                        "isSignatureEnabled": false,
                        "isSavableByApprover": false,
                        "hasNoAssigneeAction": false,
                        "noAssigneeActionEvents": [],
                        "hasSameApproverAction": false,
                        "hasAvoidSkipSameApproverAction": false,
                        "sameApproverActionEvents": [],
                        "isMandatoryComment": false,
                        "isSignatureMandatory": false,
                        "minCharacter": 0,
                        "customizeComments": [],
                        "approverStages": [],
                        "assignOption": "OneAssignee",
                        "assignOptionNumber": 0,
                        "skipMyTaskForSameRequestorApprover": false,
                        "runIntegrationSynchronously": false
                      },
                      "assignedTos": [
                        {
                          "assignedType": "externaluser",
                          "assignedTo": "{\"type\":\"field\",\"value\":\"txtEmail\"}"
                        }
                      ],
                      "readers": [],
                      "workflowStageTriggers": [],
                      "workflowStageSLA": {
                        "slaDuration": 0,
                        "slaThreshold": 0,
                        "workingDays": [],
                        "workingHoursPerDay": 0
                      },
                      "actions": [
                        {
                          "workflowActionId": 7903,
                          "workflowActionCode": "dbd080b1-e8af-4d3b-b66d-e5c1d8a4b9d1",
                          "actionType": "standard",
                          "options": {
                            "buttonName": {
                              "key": "Close",
                              "type": "custom",
                              "values": [
                                {
                                  "language": "en-US",
                                  "value": "Close"
                                },
                                {
                                  "language": "zh-Hans",
                                  "value": "批准"
                                },
                                {
                                  "language": "zh-Hant",
                                  "value": "批准"
                                },
                                {
                                  "language": "th-TH",
                                  "value": "อนุมัติ"
                                }
                              ]
                            },
                            "buttonColor": "btn-darkgrey",
                            "sequence": "1",
                            "seqNo": 0,
                            "conditionalActionEvent": false,
                            "systemAction": true,
                            "condition": {
                              "conditionGroups": []
                            },
                            "allowFieldValidation": false,
                            "fieldValidationGroups": [],
                            "workflowActionId": 0
                          },
                          "deleteLock": true,
                          "eventLists": [
                            {
                              "ruleName": "Rule 1",
                              "assignOption": "OneAssignee",
                              "events": [
                                {
                                  "eventType": "GotoStage",
                                  "workflowStageId": 6345,
                                  "stageTitle": {
                                    "workflowStageId": 6345,
                                    "title": {
                                      "key": "approved",
                                      "type": "custom",
                                      "values": [
                                        {
                                          "language": "en-US",
                                          "value": "Approved"
                                        },
                                        {
                                          "language": "zh-Hans",
                                          "value": "已批准"
                                        },
                                        {
                                          "language": "id-ID",
                                          "value": "Disetujui"
                                        },
                                        {
                                          "language": "ms-MY",
                                          "value": "Diluluskan"
                                        },
                                        {
                                          "language": "zh-Hant",
                                          "value": "已批准"
                                        },
                                        {
                                          "language": "th-TH",
                                          "value": "ที่ได้รับการอนุมัติ"
                                        }
                                      ]
                                    }
                                  },
                                  "config": {}
                                }
                              ]
                            }
                          ],
                          "notificationCount": 0,
                          "title": {
                            "key": "Close",
                            "type": "custom",
                            "values": [
                              {
                                "language": "en-US",
                                "value": "Close"
                              },
                              {
                                "language": "zh-Hans",
                                "value": "批准"
                              },
                              {
                                "language": "zh-Hant",
                                "value": "批准"
                              },
                              {
                                "language": "th-TH",
                                "value": "อนุมัติ"
                              }
                            ]
                          }
                        }
                      ],
                      "parallelWorkflowStageId": 6341,
                      "parallelDeleteLock": false,
                      "hasNoStageNotifToAssignee": false
                    },
                    {
                      "parallelSet": 2,
                      "workflowId": 215,
                      "workflowVersionId": 810,
                      "workflowStageId": 6345,
                      "workflowStageCode": "CourtesyCarReturnParallelStage_BranchApproved2",
                      "title": {
                        "key": "approved",
                        "type": "custom",
                        "values": [
                          {
                            "language": "en-US",
                            "value": "Approved"
                          },
                          {
                            "language": "zh-Hans",
                            "value": "已批准"
                          },
                          {
                            "language": "id-ID",
                            "value": "Disetujui"
                          },
                          {
                            "language": "ms-MY",
                            "value": "Diluluskan"
                          },
                          {
                            "language": "zh-Hant",
                            "value": "已批准"
                          },
                          {
                            "language": "th-TH",
                            "value": "ที่ได้รับการอนุมัติ"
                          }
                        ]
                      },
                      "displayName": {
                        "key": "approved",
                        "type": "custom",
                        "values": [
                          {
                            "language": "en-US",
                            "value": "Approved"
                          },
                          {
                            "language": "zh-Hans",
                            "value": "已批准"
                          },
                          {
                            "language": "id-ID",
                            "value": "Disetujui"
                          },
                          {
                            "language": "ms-MY",
                            "value": "Diluluskan"
                          },
                          {
                            "language": "zh-Hant",
                            "value": "已批准"
                          },
                          {
                            "language": "th-TH",
                            "value": "ที่ได้รับการอนุมัติ"
                          }
                        ]
                      },
                      "stageType": "Standard",
                      "seqNo": 2,
                      "isEndStage": true,
                      "isApprovedStage": true,
                      "isSLA": false,
                      "isPublished": true,
                      "stageConfig": {
                        "stageTypeConfigs": [],
                        "isAllowDelegation": false,
                        "isAllowDelegationToGroup": false,
                        "isAllowRequestorAssignUser": false,
                        "hasStageReview": false,
                        "options": {
                          "displaySequence": 0,
                          "isAllowComment": false,
                          "isAllowCommentInGeneralComment": false,
                          "isAllowCommentCustomize": false,
                          "isAllowEditOtherFields": false,
                          "isAllowTrigger": false,
                          "isSignatureEnabled": false,
                          "isSavableByApprover": false,
                          "hasNoAssigneeAction": false,
                          "hasSameApproverAction": false,
                          "hasAvoidSkipSameApproverAction": false,
                          "isMandatoryComment": false,
                          "isSignatureMandatory": false,
                          "minCharacter": 0,
                          "customizeComments": [],
                          "approverStages": [],
                          "assignOptionNumber": 0,
                          "skipMyTaskForSameRequestorApprover": false,
                          "runIntegrationSynchronously": false
                        }
                      },
                      "notificationCount": 0,
                      "reminderCount": 0,
                      "integrationCount": 0,
                      "deleteLock": true,
                      "requestorSubLock": false,
                      "options": {
                        "displaySequence": 0,
                        "isAllowComment": false,
                        "isAllowCommentInGeneralComment": false,
                        "isAllowCommentCustomize": false,
                        "isAllowEditOtherFields": false,
                        "isAllowTrigger": false,
                        "isSignatureEnabled": false,
                        "isSavableByApprover": false,
                        "hasNoAssigneeAction": false,
                        "hasSameApproverAction": false,
                        "hasAvoidSkipSameApproverAction": false,
                        "isMandatoryComment": false,
                        "isSignatureMandatory": false,
                        "minCharacter": 0,
                        "customizeComments": [],
                        "approverStages": [],
                        "assignOptionNumber": 0,
                        "skipMyTaskForSameRequestorApprover": false,
                        "runIntegrationSynchronously": false
                      },
                      "assignedTos": [],
                      "readers": [],
                      "workflowStageTriggers": [],
                      "actions": [],
                      "parallelWorkflowStageId": 6341,
                      "parallelDeleteLock": false,
                      "hasNoStageNotifToAssignee": true
                    }
                  ]
                }
              ],
              "hasNoStageNotifToAssignee": true
            },
            {
              "workflowId": 215,
              "workflowVersionId": 810,
              "workflowStageId": 6335,
              "workflowStageCode": "ExtensionApproval",
              "title": {
                "key": "Extension Approval",
                "type": "custom",
                "values": [
                  {
                    "language": "en-US",
                    "value": "Extension Approval"
                  },
                  {
                    "language": "zh-Hans",
                    "value": ""
                  },
                  {
                    "language": "zh-Hant",
                    "value": ""
                  },
                  {
                    "language": "th-TH",
                    "value": ""
                  }
                ]
              },
              "displayName": {
                "key": "Pending Extension Approval",
                "type": "custom",
                "values": [
                  {
                    "language": "en-US",
                    "value": "Pending Extension Approval"
                  },
                  {
                    "language": "zh-Hans",
                    "value": ""
                  },
                  {
                    "language": "zh-Hant",
                    "value": ""
                  },
                  {
                    "language": "th-TH",
                    "value": ""
                  }
                ]
              },
              "stageType": "Standard",
              "seqNo": 8,
              "isEndStage": false,
              "isApprovedStage": false,
              "isSLA": true,
              "isPublished": true,
              "stageConfig": {
                "stageTypeConfigs": [
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "znCollectAcknowledge",
                    "selectedFieldTypeId": 24,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "tblCollectedItem",
                    "selectedFieldTypeId": 20,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "znOutsideTable",
                    "selectedFieldTypeId": 24,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "znReturnAcknowledge",
                    "selectedFieldTypeId": 24,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "tblReturnedItem",
                    "selectedFieldTypeId": 20,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "znOutsideTableRe",
                    "selectedFieldTypeId": 24,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "znUploadGatePass",
                    "selectedFieldTypeId": 24,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "fuGatePass",
                    "selectedFieldTypeId": 5,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "tblTnC",
                    "selectedFieldTypeId": 20,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "znOutsideTnC",
                    "selectedFieldTypeId": 24,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "znReassignment",
                    "selectedFieldTypeId": 24,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "pplReassignTo",
                    "selectedFieldTypeId": 13,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "znReuqestToExtend",
                    "selectedFieldTypeId": 24,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  }
                ],
                "isAllowDelegation": false,
                "isAllowDelegationToGroup": false,
                "isAllowRequestorAssignUser": false,
                "hasStageReview": false,
                "options": {
                  "displaySequence": 0,
                  "isAllowComment": true,
                  "isAllowCommentInGeneralComment": false,
                  "isAllowCommentCustomize": false,
                  "isAllowEditOtherFields": false,
                  "isAllowTrigger": false,
                  "isSignatureEnabled": true,
                  "isSavableByApprover": false,
                  "hasNoAssigneeAction": false,
                  "noAssigneeActionEvents": [],
                  "hasSameApproverAction": false,
                  "hasAvoidSkipSameApproverAction": false,
                  "sameApproverActionEvents": [],
                  "isMandatoryComment": true,
                  "isSignatureMandatory": true,
                  "actionButtons": [
                    "f97bdd1d-da0d-451d-bd40-629f05224401",
                    "98a5eb20-fad4-4136-a9d0-f78e6ba0af04",
                    "2b1d6e01-5a9d-486c-9bb2-cffed4682629"
                  ],
                  "signatureActionButtons": [
                    "83679d80-c081-404f-bcd8-441157070b60"
                  ],
                  "minCharacter": 5,
                  "customizeComments": [],
                  "approverStages": [],
                  "assignOption": "OneAssignee",
                  "assignOptionNumber": 0,
                  "skipMyTaskForSameRequestorApprover": false,
                  "runIntegrationSynchronously": false
                }
              },
              "notificationCount": 1,
              "reminderCount": 1,
              "integrationCount": 0,
              "deleteLock": false,
              "requestorSubLock": false,
              "options": {
                "displaySequence": 0,
                "isAllowComment": true,
                "isAllowCommentInGeneralComment": false,
                "isAllowCommentCustomize": false,
                "isAllowEditOtherFields": false,
                "isAllowTrigger": false,
                "isSignatureEnabled": true,
                "isSavableByApprover": false,
                "hasNoAssigneeAction": false,
                "noAssigneeActionEvents": [],
                "hasSameApproverAction": false,
                "hasAvoidSkipSameApproverAction": false,
                "sameApproverActionEvents": [],
                "isMandatoryComment": true,
                "isSignatureMandatory": true,
                "actionButtons": [
                  "f97bdd1d-da0d-451d-bd40-629f05224401",
                  "98a5eb20-fad4-4136-a9d0-f78e6ba0af04",
                  "2b1d6e01-5a9d-486c-9bb2-cffed4682629"
                ],
                "signatureActionButtons": [
                  "83679d80-c081-404f-bcd8-441157070b60"
                ],
                "minCharacter": 5,
                "customizeComments": [],
                "approverStages": [],
                "assignOption": "OneAssignee",
                "assignOptionNumber": 0,
                "skipMyTaskForSameRequestorApprover": false,
                "runIntegrationSynchronously": false
              },
              "assignedTos": [
                {
                  "assignedType": "matrix",
                  "assignedTo": "{\"selectedMatrixId\":49,\"selectedMatrix\":\"ABRBranchApprover\",\"matrixApprover\":[\"DP\"],\"matrixConditions\":[{\"matrixColumnId\":220,\"matrixField\":\"BranchDescription\",\"columnType\":\"text\",\"type\":\"field\",\"value\":\"ddlBranch\",\"valueFrom\":\"\"},{\"matrixColumnId\":308,\"matrixField\":\"BranchSegment\",\"columnType\":\"text\",\"type\":\"field\",\"value\":\"txtBranchSegment\",\"valueFrom\":\"\"},{\"matrixColumnId\":347,\"matrixField\":\"BranchMake\",\"columnType\":\"text\",\"type\":\"field\",\"value\":\"ddlMake\",\"valueFrom\":\"\"}]}"
                }
              ],
              "readers": [],
              "workflowStageTriggers": [],
              "workflowStageSLA": {
                "slaDuration": 1,
                "slaThreshold": 0,
                "workingDays": [
                  1,
                  2,
                  3,
                  4,
                  5
                ],
                "workingHoursPerDay": 8
              },
              "actions": [
                {
                  "workflowActionId": 7886,
                  "workflowActionCode": "83679d80-c081-404f-bcd8-441157070b60",
                  "actionType": "standard",
                  "seqNo": 1,
                  "options": {
                    "buttonName": {
                      "key": "Approve",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": ""
                        },
                        {
                          "language": "zh-Hans",
                          "value": ""
                        },
                        {
                          "language": "zh-Hant",
                          "value": ""
                        },
                        {
                          "language": "th-TH",
                          "value": ""
                        }
                      ]
                    },
                    "buttonColor": "btn-primary",
                    "sequence": "1",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": true,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "deleteLock": true,
                  "eventLists": [
                    {
                      "ruleName": "Rule 1",
                      "assignOption": "OneAssignee",
                      "events": [
                        {
                          "eventType": "GotoStage",
                          "workflowStageId": 6341,
                          "stageTitle": {
                            "workflowStageId": 6341,
                            "title": {
                              "key": "Courtesy Car Return",
                              "type": "custom",
                              "values": [
                                {
                                  "language": "en-US",
                                  "value": "Courtesy Car Return"
                                },
                                {
                                  "language": "zh-Hans",
                                  "value": ""
                                },
                                {
                                  "language": "zh-Hant",
                                  "value": ""
                                },
                                {
                                  "language": "th-TH",
                                  "value": ""
                                }
                              ]
                            }
                          },
                          "config": {}
                        },
                        {
                          "eventType": "SetValue",
                          "workflowStageId": 0,
                          "config": {
                            "fieldCode": "rbIsCarReturnStage",
                            "fieldValue": {
                              "value": "True"
                            }
                          }
                        },
                        {
                          "eventType": "SetValue",
                          "workflowStageId": 0,
                          "config": {
                            "fieldCode": "var_isFromExtended",
                            "fieldValue": {
                              "value": "true"
                            }
                          }
                        }
                      ]
                    }
                  ],
                  "notificationCount": 1,
                  "title": {
                    "key": "Approve",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": ""
                      },
                      {
                        "language": "zh-Hans",
                        "value": ""
                      },
                      {
                        "language": "zh-Hant",
                        "value": ""
                      },
                      {
                        "language": "th-TH",
                        "value": ""
                      }
                    ]
                  }
                },
                {
                  "workflowActionId": 7887,
                  "workflowActionCode": "2b1d6e01-5a9d-486c-9bb2-cffed4682629",
                  "actionType": "standard",
                  "seqNo": 2,
                  "options": {
                    "buttonName": {
                      "key": "Reject",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": "Reject"
                        },
                        {
                          "language": "zh-Hans",
                          "value": ""
                        },
                        {
                          "language": "zh-Hant",
                          "value": ""
                        },
                        {
                          "language": "th-TH",
                          "value": ""
                        }
                      ]
                    },
                    "buttonColor": "btn-danger",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": false,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "deleteLock": false,
                  "eventLists": [
                    {
                      "ruleName": "Rule 1",
                      "assignOption": "OneAssignee",
                      "events": [
                        {
                          "eventType": "GotoStage",
                          "workflowStageId": 6341,
                          "stageTitle": {
                            "workflowStageId": 6341,
                            "title": {
                              "key": "Courtesy Car Return",
                              "type": "custom",
                              "values": [
                                {
                                  "language": "en-US",
                                  "value": "Courtesy Car Return"
                                },
                                {
                                  "language": "zh-Hans",
                                  "value": ""
                                },
                                {
                                  "language": "zh-Hant",
                                  "value": ""
                                },
                                {
                                  "language": "th-TH",
                                  "value": ""
                                }
                              ]
                            }
                          },
                          "config": {}
                        },
                        {
                          "eventType": "SetValue",
                          "workflowStageId": 0,
                          "config": {
                            "fieldCode": "rbIsCarReturnStage",
                            "fieldValue": {
                              "value": "True"
                            }
                          }
                        },
                        {
                          "eventType": "SetValue",
                          "workflowStageId": 0,
                          "config": {
                            "fieldCode": "var_isFromExtended",
                            "fieldValue": {
                              "value": "true"
                            }
                          }
                        }
                      ]
                    }
                  ],
                  "notificationCount": 1,
                  "title": {
                    "key": "Reject",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Reject"
                      },
                      {
                        "language": "zh-Hans",
                        "value": ""
                      },
                      {
                        "language": "zh-Hant",
                        "value": ""
                      },
                      {
                        "language": "th-TH",
                        "value": ""
                      }
                    ]
                  }
                },
                {
                  "workflowActionId": 7888,
                  "workflowActionCode": "98a5eb20-fad4-4136-a9d0-f78e6ba0af04",
                  "actionType": "standard",
                  "seqNo": 3,
                  "options": {
                    "buttonName": {
                      "key": "Return to Requestor",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": "Return to Requestor"
                        },
                        {
                          "language": "zh-Hans",
                          "value": ""
                        },
                        {
                          "language": "zh-Hant",
                          "value": ""
                        },
                        {
                          "language": "th-TH",
                          "value": ""
                        }
                      ]
                    },
                    "buttonColor": "btn-warning",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": false,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "deleteLock": false,
                  "eventLists": [
                    {
                      "ruleName": "Rule 1",
                      "assignOption": "OneAssignee",
                      "events": [
                        {
                          "eventType": "GotoStage",
                          "workflowStageId": 6348,
                          "stageTitle": {
                            "workflowStageId": 6348,
                            "title": {
                              "key": "Coutersy Car Amendment",
                              "type": "custom",
                              "values": [
                                {
                                  "language": "en-US",
                                  "value": "Coutersy Car Amendment"
                                },
                                {
                                  "language": "zh-Hans",
                                  "value": ""
                                },
                                {
                                  "language": "zh-Hant",
                                  "value": ""
                                },
                                {
                                  "language": "th-TH",
                                  "value": ""
                                }
                              ]
                            }
                          },
                          "config": {}
                        },
                        {
                          "eventType": "SetValue",
                          "workflowStageId": 0,
                          "config": {
                            "fieldCode": "var_isFromExtended",
                            "fieldValue": {
                              "value": "true"
                            }
                          }
                        }
                      ]
                    }
                  ],
                  "notificationCount": 0,
                  "title": {
                    "key": "Return to Requestor",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Return to Requestor"
                      },
                      {
                        "language": "zh-Hans",
                        "value": ""
                      },
                      {
                        "language": "zh-Hant",
                        "value": ""
                      },
                      {
                        "language": "th-TH",
                        "value": ""
                      }
                    ]
                  }
                },
                {
                  "workflowActionId": 7889,
                  "workflowActionCode": "f97bdd1d-da0d-451d-bd40-629f05224401",
                  "actionType": "standard",
                  "seqNo": 4,
                  "options": {
                    "buttonName": {
                      "key": "Reassignment",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": "Reassignment"
                        },
                        {
                          "language": "zh-Hans",
                          "value": ""
                        },
                        {
                          "language": "zh-Hant",
                          "value": ""
                        },
                        {
                          "language": "th-TH",
                          "value": ""
                        }
                      ]
                    },
                    "buttonColor": "btn-info",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": false,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": true,
                    "fieldValidationGroups": [
                      {
                        "validations": [
                          {
                            "validationType": "mandatory",
                            "fieldCode": "pplReassignTo"
                          }
                        ]
                      }
                    ],
                    "workflowActionId": 0
                  },
                  "deleteLock": false,
                  "eventLists": [
                    {
                      "ruleName": "Rule 1",
                      "assignOption": "OneAssignee",
                      "events": [
                        {
                          "eventType": "GotoStage",
                          "workflowStageId": 6336,
                          "stageTitle": {
                            "workflowStageId": 6336,
                            "title": {
                              "key": "Additional Information Enquiry",
                              "type": "custom",
                              "values": [
                                {
                                  "language": "en-US",
                                  "value": "Additional Information Enquiry"
                                },
                                {
                                  "language": "zh-Hans",
                                  "value": ""
                                },
                                {
                                  "language": "zh-Hant",
                                  "value": ""
                                },
                                {
                                  "language": "th-TH",
                                  "value": ""
                                }
                              ]
                            }
                          },
                          "config": {}
                        },
                        {
                          "eventType": "SetValue",
                          "workflowStageId": 0,
                          "config": {
                            "fieldCode": "var_isReassignment",
                            "fieldValue": {
                              "value": "true"
                            }
                          }
                        }
                      ]
                    }
                  ],
                  "notificationCount": 0,
                  "title": {
                    "key": "Reassignment",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Reassignment"
                      },
                      {
                        "language": "zh-Hans",
                        "value": ""
                      },
                      {
                        "language": "zh-Hant",
                        "value": ""
                      },
                      {
                        "language": "th-TH",
                        "value": ""
                      }
                    ]
                  }
                }
              ],
              "parallels": [],
              "parallelCompletes": [],
              "parallelDeleteLock": true,
              "parallelSets": [],
              "hasNoStageNotifToAssignee": false
            },
            {
              "workflowId": 215,
              "workflowVersionId": 810,
              "workflowStageId": 6336,
              "workflowStageCode": "AdditionalInformationEnquiry",
              "title": {
                "key": "Additional Information Enquiry",
                "type": "custom",
                "values": [
                  {
                    "language": "en-US",
                    "value": "Additional Information Enquiry"
                  },
                  {
                    "language": "zh-Hans",
                    "value": ""
                  },
                  {
                    "language": "zh-Hant",
                    "value": ""
                  },
                  {
                    "language": "th-TH",
                    "value": ""
                  }
                ]
              },
              "displayName": {
                "key": "Pending Additional Information Enquiry",
                "type": "custom",
                "values": [
                  {
                    "language": "en-US",
                    "value": "Pending Additional Information Enquiry"
                  },
                  {
                    "language": "zh-Hans",
                    "value": ""
                  },
                  {
                    "language": "zh-Hant",
                    "value": ""
                  },
                  {
                    "language": "th-TH",
                    "value": ""
                  }
                ]
              },
              "stageType": "Standard",
              "seqNo": 9,
              "isEndStage": false,
              "isApprovedStage": false,
              "isSLA": true,
              "isPublished": true,
              "stageConfig": {
                "stageTypeConfigs": [
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "znAdditionalInfo",
                    "selectedFieldTypeId": 24,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": true,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "fuAdditionalDocument",
                    "selectedFieldTypeId": 5,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  }
                ],
                "isAllowDelegation": false,
                "isAllowDelegationToGroup": false,
                "isAllowRequestorAssignUser": false,
                "hasStageReview": false,
                "options": {
                  "displaySequence": 0,
                  "isAllowComment": true,
                  "isAllowCommentInGeneralComment": false,
                  "isAllowCommentCustomize": false,
                  "isAllowEditOtherFields": false,
                  "isAllowTrigger": false,
                  "isSignatureEnabled": false,
                  "isSavableByApprover": false,
                  "hasNoAssigneeAction": false,
                  "noAssigneeActionEvents": [],
                  "hasSameApproverAction": false,
                  "hasAvoidSkipSameApproverAction": false,
                  "sameApproverActionEvents": [],
                  "isMandatoryComment": true,
                  "isSignatureMandatory": false,
                  "actionButtons": [
                    "764761a3-aafa-43ba-8d5b-0d41dd800b43"
                  ],
                  "minCharacter": 5,
                  "customizeComments": [],
                  "approverStages": [],
                  "assignOption": "OneAssignee",
                  "assignOptionNumber": 0,
                  "skipMyTaskForSameRequestorApprover": false,
                  "runIntegrationSynchronously": false
                }
              },
              "notificationCount": 1,
              "reminderCount": 1,
              "integrationCount": 0,
              "deleteLock": false,
              "requestorSubLock": false,
              "options": {
                "displaySequence": 0,
                "isAllowComment": true,
                "isAllowCommentInGeneralComment": false,
                "isAllowCommentCustomize": false,
                "isAllowEditOtherFields": false,
                "isAllowTrigger": false,
                "isSignatureEnabled": false,
                "isSavableByApprover": false,
                "hasNoAssigneeAction": false,
                "noAssigneeActionEvents": [],
                "hasSameApproverAction": false,
                "hasAvoidSkipSameApproverAction": false,
                "sameApproverActionEvents": [],
                "isMandatoryComment": true,
                "isSignatureMandatory": false,
                "actionButtons": [
                  "764761a3-aafa-43ba-8d5b-0d41dd800b43"
                ],
                "minCharacter": 5,
                "customizeComments": [],
                "approverStages": [],
                "assignOption": "OneAssignee",
                "assignOptionNumber": 0,
                "skipMyTaskForSameRequestorApprover": false,
                "runIntegrationSynchronously": false
              },
              "assignedTos": [
                {
                  "assignedType": "peoplepicker",
                  "assignedTo": "pplReassignTo"
                }
              ],
              "readers": [],
              "workflowStageTriggers": [],
              "workflowStageSLA": {
                "slaDuration": 1,
                "slaThreshold": 0,
                "workingDays": [
                  1,
                  2,
                  3,
                  4,
                  5
                ],
                "workingHoursPerDay": 8
              },
              "actions": [
                {
                  "workflowActionId": 7890,
                  "workflowActionCode": "764761a3-aafa-43ba-8d5b-0d41dd800b43",
                  "actionType": "standard",
                  "options": {
                    "buttonName": {
                      "key": "Update",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": "Update"
                        },
                        {
                          "language": "zh-Hans",
                          "value": ""
                        },
                        {
                          "language": "zh-Hant",
                          "value": ""
                        },
                        {
                          "language": "th-TH",
                          "value": ""
                        }
                      ]
                    },
                    "buttonColor": "btn-primary",
                    "sequence": "1",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": true,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "deleteLock": true,
                  "eventLists": [
                    {
                      "ruleName": "Rule 1",
                      "assignOption": "OneAssignee",
                      "events": [
                        {
                          "eventType": "BacktoPrevStage",
                          "workflowStageId": 0,
                          "config": {}
                        },
                        {
                          "eventType": "SetValue",
                          "workflowStageId": 0,
                          "config": {
                            "fieldCode": "var_isReassignment",
                            "fieldValue": {
                              "value": "true"
                            }
                          }
                        }
                      ]
                    }
                  ],
                  "notificationCount": 0,
                  "title": {
                    "key": "Update",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Update"
                      },
                      {
                        "language": "zh-Hans",
                        "value": ""
                      },
                      {
                        "language": "zh-Hant",
                        "value": ""
                      },
                      {
                        "language": "th-TH",
                        "value": ""
                      }
                    ]
                  }
                }
              ],
              "parallels": [],
              "parallelCompletes": [],
              "parallelDeleteLock": true,
              "parallelSets": [],
              "hasNoStageNotifToAssignee": false
            },
            {
              "workflowId": 215,
              "workflowVersionId": 810,
              "workflowStageId": 6337,
              "workflowStageCode": "FurtherDelegationApproval",
              "title": {
                "key": "Further Delegation Approval",
                "type": "custom",
                "values": [
                  {
                    "language": "en-US",
                    "value": "Further Delegation Approval"
                  },
                  {
                    "language": "zh-Hans",
                    "value": ""
                  },
                  {
                    "language": "zh-Hant",
                    "value": ""
                  },
                  {
                    "language": "th-TH",
                    "value": ""
                  }
                ]
              },
              "displayName": {
                "key": "Pending Further Delegation Approval",
                "type": "custom",
                "values": [
                  {
                    "language": "en-US",
                    "value": "Pending Further Delegation Approval"
                  },
                  {
                    "language": "zh-Hans",
                    "value": ""
                  },
                  {
                    "language": "zh-Hant",
                    "value": ""
                  },
                  {
                    "language": "th-TH",
                    "value": ""
                  }
                ]
              },
              "stageType": "Standard",
              "seqNo": 10,
              "isEndStage": false,
              "isApprovedStage": false,
              "isSLA": true,
              "isPublished": true,
              "stageConfig": {
                "stageTypeConfigs": [],
                "isAllowDelegation": false,
                "isAllowDelegationToGroup": false,
                "isAllowRequestorAssignUser": false,
                "hasStageReview": false,
                "options": {
                  "displaySequence": 0,
                  "isAllowComment": true,
                  "isAllowCommentInGeneralComment": false,
                  "isAllowCommentCustomize": false,
                  "isAllowEditOtherFields": false,
                  "isAllowTrigger": false,
                  "isSignatureEnabled": true,
                  "isSavableByApprover": false,
                  "hasNoAssigneeAction": false,
                  "noAssigneeActionEvents": [],
                  "hasSameApproverAction": false,
                  "hasAvoidSkipSameApproverAction": false,
                  "sameApproverActionEvents": [],
                  "isMandatoryComment": true,
                  "isSignatureMandatory": true,
                  "actionButtons": [
                    "f0c8f0be-d615-4086-a17c-ca5e954d37ae"
                  ],
                  "signatureActionButtons": [
                    "b83c667e-bd9f-4db5-beda-0791d281534f"
                  ],
                  "minCharacter": 5,
                  "customizeComments": [],
                  "approverStages": [],
                  "assignOption": "OneAssignee",
                  "assignOptionNumber": 0,
                  "skipMyTaskForSameRequestorApprover": false,
                  "runIntegrationSynchronously": false
                }
              },
              "notificationCount": 1,
              "reminderCount": 1,
              "integrationCount": 0,
              "deleteLock": false,
              "requestorSubLock": false,
              "options": {
                "displaySequence": 0,
                "isAllowComment": true,
                "isAllowCommentInGeneralComment": false,
                "isAllowCommentCustomize": false,
                "isAllowEditOtherFields": false,
                "isAllowTrigger": false,
                "isSignatureEnabled": true,
                "isSavableByApprover": false,
                "hasNoAssigneeAction": false,
                "noAssigneeActionEvents": [],
                "hasSameApproverAction": false,
                "hasAvoidSkipSameApproverAction": false,
                "sameApproverActionEvents": [],
                "isMandatoryComment": true,
                "isSignatureMandatory": true,
                "actionButtons": [
                  "f0c8f0be-d615-4086-a17c-ca5e954d37ae"
                ],
                "signatureActionButtons": [
                  "b83c667e-bd9f-4db5-beda-0791d281534f"
                ],
                "minCharacter": 5,
                "customizeComments": [],
                "approverStages": [],
                "assignOption": "OneAssignee",
                "assignOptionNumber": 0,
                "skipMyTaskForSameRequestorApprover": false,
                "runIntegrationSynchronously": false
              },
              "assignedTos": [
                {
                  "assignedType": "peoplepicker",
                  "assignedTo": "pplDelegateto"
                }
              ],
              "readers": [],
              "workflowStageTriggers": [],
              "workflowStageSLA": {
                "slaDuration": 1,
                "slaThreshold": 0,
                "workingDays": [
                  1,
                  2,
                  3,
                  4,
                  5
                ],
                "workingHoursPerDay": 8
              },
              "actions": [
                {
                  "workflowActionId": 7891,
                  "workflowActionCode": "b83c667e-bd9f-4db5-beda-0791d281534f",
                  "actionType": "standard",
                  "seqNo": 1,
                  "options": {
                    "buttonName": {
                      "key": "Approve",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": ""
                        },
                        {
                          "language": "zh-Hans",
                          "value": ""
                        },
                        {
                          "language": "zh-Hant",
                          "value": ""
                        },
                        {
                          "language": "th-TH",
                          "value": ""
                        }
                      ]
                    },
                    "buttonColor": "btn-primary",
                    "sequence": "1",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": true,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "deleteLock": true,
                  "eventLists": [
                    {
                      "ruleName": "Rule 1",
                      "assignOption": "OneAssignee",
                      "events": [
                        {
                          "eventType": "GotoStage",
                          "workflowStageId": 6347,
                          "stageTitle": {
                            "workflowStageId": 6347,
                            "title": {
                              "key": "Courtesy Car Collection",
                              "type": "custom",
                              "values": [
                                {
                                  "language": "en-US",
                                  "value": "Courtesy Car Collection"
                                }
                              ]
                            }
                          },
                          "config": {}
                        },
                        {
                          "eventType": "SetValue",
                          "workflowStageId": 0,
                          "config": {
                            "fieldCode": "var_isReassignment",
                            "fieldValue": {
                              "value": "false"
                            }
                          }
                        }
                      ]
                    }
                  ],
                  "notificationCount": 0,
                  "title": {
                    "key": "Approve",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": ""
                      },
                      {
                        "language": "zh-Hans",
                        "value": ""
                      },
                      {
                        "language": "zh-Hant",
                        "value": ""
                      },
                      {
                        "language": "th-TH",
                        "value": ""
                      }
                    ]
                  }
                },
                {
                  "workflowActionId": 7892,
                  "workflowActionCode": "f0c8f0be-d615-4086-a17c-ca5e954d37ae",
                  "actionType": "standard",
                  "seqNo": 2,
                  "options": {
                    "buttonName": {
                      "key": "Reject",
                      "type": "custom",
                      "values": [
                        {
                          "language": "en-US",
                          "value": "Reject"
                        }
                      ]
                    },
                    "buttonColor": "btn-danger",
                    "seqNo": 0,
                    "conditionalActionEvent": false,
                    "systemAction": false,
                    "condition": {
                      "conditionGroups": []
                    },
                    "allowFieldValidation": false,
                    "fieldValidationGroups": [],
                    "workflowActionId": 0
                  },
                  "deleteLock": false,
                  "eventLists": [
                    {
                      "ruleName": "Rule 1",
                      "assignOption": "OneAssignee",
                      "events": [
                        {
                          "eventType": "GotoStage",
                          "workflowStageId": 6338,
                          "stageTitle": {
                            "workflowStageId": 6338,
                            "title": {
                              "key": "Rejected",
                              "type": "custom",
                              "values": [
                                {
                                  "language": "en-US",
                                  "value": "Rejected"
                                }
                              ]
                            }
                          },
                          "config": {}
                        }
                      ]
                    }
                  ],
                  "notificationCount": 0,
                  "title": {
                    "key": "Reject",
                    "type": "custom",
                    "values": [
                      {
                        "language": "en-US",
                        "value": "Reject"
                      }
                    ]
                  }
                }
              ],
              "parallels": [],
              "parallelCompletes": [],
              "parallelDeleteLock": true,
              "parallelSets": [],
              "hasNoStageNotifToAssignee": false
            },
            {
              "workflowId": 215,
              "workflowVersionId": 810,
              "workflowStageId": 6332,
              "workflowStageCode": "Approved",
              "title": {
                "key": "Completed",
                "type": "custom",
                "values": [
                  {
                    "language": "en-US",
                    "value": "Completed"
                  },
                  {
                    "language": "zh-Hans",
                    "value": ""
                  },
                  {
                    "language": "zh-Hant",
                    "value": ""
                  },
                  {
                    "language": "th-TH",
                    "value": ""
                  }
                ]
              },
              "displayName": {
                "key": "Completed",
                "type": "custom",
                "values": [
                  {
                    "language": "en-US",
                    "value": "Completed"
                  },
                  {
                    "language": "zh-Hans",
                    "value": ""
                  },
                  {
                    "language": "zh-Hant",
                    "value": ""
                  },
                  {
                    "language": "th-TH",
                    "value": ""
                  }
                ]
              },
              "stageType": "Standard",
              "seqNo": 11,
              "isEndStage": true,
              "isApprovedStage": true,
              "isSLA": false,
              "isPublished": true,
              "stageConfig": {
                "stageTypeConfigs": [
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "znReturnAcknowledge",
                    "selectedFieldTypeId": 24,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "znCollectAcknowledge",
                    "selectedFieldTypeId": 24,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "tblCollectedItem",
                    "selectedFieldTypeId": 20,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "znOutsideTable",
                    "selectedFieldTypeId": 24,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "znUploadGatePass",
                    "selectedFieldTypeId": 24,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "fuGatePass",
                    "selectedFieldTypeId": 5,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "znOutsideTnC",
                    "selectedFieldTypeId": 24,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  },
                  {
                    "isApproverEditable": false,
                    "isMandatory": false,
                    "isAllowStageApproverEdit": false,
                    "selectedFieldCode": "tblTnC",
                    "selectedFieldTypeId": 20,
                    "approverStages": [],
                    "visibleTo": "Everyone",
                    "isExcludeReader": false,
                    "specificUsers": []
                  }
                ],
                "isAllowDelegation": false,
                "isAllowDelegationToGroup": false,
                "isAllowRequestorAssignUser": false,
                "hasStageReview": false,
                "options": {
                  "displaySequence": 0,
                  "isAllowComment": false,
                  "isAllowCommentInGeneralComment": false,
                  "isAllowCommentCustomize": false,
                  "isAllowEditOtherFields": false,
                  "isAllowTrigger": true,
                  "isSignatureEnabled": false,
                  "isSavableByApprover": false,
                  "hasNoAssigneeAction": false,
                  "noAssigneeActionEvents": [],
                  "hasSameApproverAction": false,
                  "hasAvoidSkipSameApproverAction": false,
                  "sameApproverActionEvents": [],
                  "isMandatoryComment": false,
                  "isSignatureMandatory": false,
                  "minCharacter": 0,
                  "customizeComments": [],
                  "approverStages": [],
                  "assignOptionNumber": 0,
                  "skipMyTaskForSameRequestorApprover": false,
                  "runIntegrationSynchronously": false
                }
              },
              "notificationCount": 1,
              "reminderCount": 0,
              "integrationCount": 2,
              "deleteLock": true,
              "requestorSubLock": false,
              "options": {
                "displaySequence": 0,
                "isAllowComment": false,
                "isAllowCommentInGeneralComment": false,
                "isAllowCommentCustomize": false,
                "isAllowEditOtherFields": false,
                "isAllowTrigger": true,
                "isSignatureEnabled": false,
                "isSavableByApprover": false,
                "hasNoAssigneeAction": false,
                "noAssigneeActionEvents": [],
                "hasSameApproverAction": false,
                "hasAvoidSkipSameApproverAction": false,
                "sameApproverActionEvents": [],
                "isMandatoryComment": false,
                "isSignatureMandatory": false,
                "minCharacter": 0,
                "customizeComments": [],
                "approverStages": [],
                "assignOptionNumber": 0,
                "skipMyTaskForSameRequestorApprover": false,
                "runIntegrationSynchronously": false
              },
              "assignedTos": [],
              "readers": [],
              "workflowStageTriggers": [
                {
                  "actionType": "Update",
                  "formIds": [],
                  "formIdRefFields": [
                    "luChassisNo"
                  ],
                  "ownerType": "SubmissionField",
                  "ownerFieldCode": "sysSubmittedBy",
                  "options": {
                    "isCopyFormAccess": false
                  },
                  "fields": [
                    {
                      "fieldCodeFrom": "ddlCarAvailable",
                      "fromFieldTypeId": 15,
                      "fieldCodeTo": "ddlCarStatus",
                      "toFieldTypeId": 15,
                      "fieldValueType": "field",
                      "isInTable": false
                    },
                    {
                      "fieldCodeFrom": "txtReturnedMileage",
                      "fromFieldTypeId": 21,
                      "fieldCodeTo": "txtLastKnownMileage",
                      "toFieldTypeId": 21,
                      "fieldValueType": "field",
                      "isInTable": false
                    }
                  ],
                  "tableFields": []
                }
              ],
              "workflowStageSLA": {
                "slaDuration": 0,
                "slaThreshold": 0,
                "workingDays": [],
                "workingHoursPerDay": 0
              },
              "actions": [],
              "parallels": [],
              "parallelCompletes": [],
              "parallelDeleteLock": true,
              "parallelSets": [],
              "hasNoStageNotifToAssignee": true
            },
            {
              "workflowId": 215,
              "workflowVersionId": 810,
              "workflowStageId": 6338,
              "workflowStageCode": "Rejected",
              "title": {
                "key": "Rejected",
                "type": "custom",
                "values": [
                  {
                    "language": "en-US",
                    "value": "Rejected"
                  }
                ]
              },
              "displayName": {
                "key": "Rejected",
                "type": "custom",
                "values": [
                  {
                    "language": "en-US",
                    "value": "Rejected"
                  }
                ]
              },
              "stageType": "Standard",
              "seqNo": 12,
              "isEndStage": true,
              "isApprovedStage": false,
              "isSLA": false,
              "isPublished": true,
              "stageConfig": {
                "stageTypeConfigs": [],
                "isAllowDelegation": false,
                "isAllowDelegationToGroup": false,
                "isAllowRequestorAssignUser": false,
                "hasStageReview": false,
                "options": {
                  "displaySequence": 0,
                  "isAllowComment": false,
                  "isAllowCommentInGeneralComment": false,
                  "isAllowCommentCustomize": false,
                  "isAllowEditOtherFields": false,
                  "isAllowTrigger": true,
                  "isSignatureEnabled": false,
                  "isSavableByApprover": false,
                  "hasNoAssigneeAction": false,
                  "noAssigneeActionEvents": [],
                  "hasSameApproverAction": false,
                  "hasAvoidSkipSameApproverAction": false,
                  "sameApproverActionEvents": [],
                  "isMandatoryComment": false,
                  "isSignatureMandatory": false,
                  "minCharacter": 0,
                  "customizeComments": [],
                  "approverStages": [],
                  "assignOption": "OneAssignee",
                  "assignOptionNumber": 0,
                  "skipMyTaskForSameRequestorApprover": false,
                  "runIntegrationSynchronously": false
                }
              },
              "notificationCount": 1,
              "reminderCount": 0,
              "integrationCount": 2,
              "deleteLock": false,
              "requestorSubLock": false,
              "options": {
                "displaySequence": 0,
                "isAllowComment": false,
                "isAllowCommentInGeneralComment": false,
                "isAllowCommentCustomize": false,
                "isAllowEditOtherFields": false,
                "isAllowTrigger": true,
                "isSignatureEnabled": false,
                "isSavableByApprover": false,
                "hasNoAssigneeAction": false,
                "noAssigneeActionEvents": [],
                "hasSameApproverAction": false,
                "hasAvoidSkipSameApproverAction": false,
                "sameApproverActionEvents": [],
                "isMandatoryComment": false,
                "isSignatureMandatory": false,
                "minCharacter": 0,
                "customizeComments": [],
                "approverStages": [],
                "assignOption": "OneAssignee",
                "assignOptionNumber": 0,
                "skipMyTaskForSameRequestorApprover": false,
                "runIntegrationSynchronously": false
              },
              "assignedTos": [],
              "readers": [],
              "workflowStageTriggers": [
                {
                  "actionType": "Update",
                  "formIds": [],
                  "formIdRefFields": [
                    "luChassisNo"
                  ],
                  "ownerType": "SubmissionField",
                  "ownerFieldCode": "sysSubmittedBy",
                  "options": {
                    "isCopyFormAccess": false
                  },
                  "fields": [
                    {
                      "fieldCodeFrom": "ddlCarAvailable",
                      "fromFieldTypeId": 15,
                      "fieldCodeTo": "ddlCarStatus",
                      "toFieldTypeId": 15,
                      "fieldValueType": "field",
                      "isInTable": false
                    }
                  ],
                  "tableFields": []
                }
              ],
              "workflowStageSLA": {
                "slaDuration": 0,
                "slaThreshold": 0,
                "workingDays": [],
                "workingHoursPerDay": 0
              },
              "actions": [],
              "parallels": [],
              "parallelCompletes": [],
              "parallelDeleteLock": true,
              "parallelSets": [],
              "hasNoStageNotifToAssignee": true
            },
            {
              "workflowId": 215,
              "workflowVersionId": 810,
              "workflowStageId": 6339,
              "workflowStageCode": "Cancelled",
              "title": {
                "key": "Cancelled",
                "type": "custom",
                "values": [
                  {
                    "language": "en-US",
                    "value": "Cancelled"
                  }
                ]
              },
              "displayName": {
                "key": "Cancelled",
                "type": "custom",
                "values": [
                  {
                    "language": "en-US",
                    "value": "Cancelled"
                  }
                ]
              },
              "stageType": "Standard",
              "seqNo": 13,
              "isEndStage": true,
              "isApprovedStage": false,
              "isSLA": false,
              "isPublished": true,
              "stageConfig": {
                "stageTypeConfigs": [],
                "isAllowDelegation": false,
                "isAllowDelegationToGroup": false,
                "isAllowRequestorAssignUser": false,
                "hasStageReview": false,
                "options": {
                  "displaySequence": 0,
                  "isAllowComment": false,
                  "isAllowCommentInGeneralComment": false,
                  "isAllowCommentCustomize": false,
                  "isAllowEditOtherFields": false,
                  "isAllowTrigger": true,
                  "isSignatureEnabled": false,
                  "isSavableByApprover": false,
                  "hasNoAssigneeAction": false,
                  "noAssigneeActionEvents": [],
                  "hasSameApproverAction": false,
                  "hasAvoidSkipSameApproverAction": false,
                  "sameApproverActionEvents": [],
                  "isMandatoryComment": false,
                  "isSignatureMandatory": false,
                  "minCharacter": 0,
                  "customizeComments": [],
                  "approverStages": [],
                  "assignOption": "OneAssignee",
                  "assignOptionNumber": 0,
                  "skipMyTaskForSameRequestorApprover": false,
                  "runIntegrationSynchronously": false
                }
              },
              "notificationCount": 1,
              "reminderCount": 0,
              "integrationCount": 2,
              "deleteLock": false,
              "requestorSubLock": false,
              "options": {
                "displaySequence": 0,
                "isAllowComment": false,
                "isAllowCommentInGeneralComment": false,
                "isAllowCommentCustomize": false,
                "isAllowEditOtherFields": false,
                "isAllowTrigger": true,
                "isSignatureEnabled": false,
                "isSavableByApprover": false,
                "hasNoAssigneeAction": false,
                "noAssigneeActionEvents": [],
                "hasSameApproverAction": false,
                "hasAvoidSkipSameApproverAction": false,
                "sameApproverActionEvents": [],
                "isMandatoryComment": false,
                "isSignatureMandatory": false,
                "minCharacter": 0,
                "customizeComments": [],
                "approverStages": [],
                "assignOption": "OneAssignee",
                "assignOptionNumber": 0,
                "skipMyTaskForSameRequestorApprover": false,
                "runIntegrationSynchronously": false
              },
              "assignedTos": [],
              "readers": [],
              "workflowStageTriggers": [
                {
                  "actionType": "Update",
                  "formIds": [],
                  "formIdRefFields": [
                    "luChassisNo"
                  ],
                  "ownerType": "SubmissionField",
                  "ownerFieldCode": "sysSubmittedBy",
                  "options": {
                    "isCopyFormAccess": false
                  },
                  "fields": [
                    {
                      "fieldCodeFrom": "ddlCarAvailable",
                      "fromFieldTypeId": 15,
                      "fieldCodeTo": "ddlCarStatus",
                      "toFieldTypeId": 15,
                      "fieldValueType": "field",
                      "isInTable": false
                    }
                  ],
                  "tableFields": []
                }
              ],
              "workflowStageSLA": {
                "slaDuration": 0,
                "slaThreshold": 0,
                "workingDays": [],
                "workingHoursPerDay": 0
              },
              "actions": [],
              "parallels": [],
              "parallelCompletes": [],
              "parallelDeleteLock": true,
              "parallelSets": [],
              "hasNoStageNotifToAssignee": true
            }
          ]
        },
        "createdDate": "2023-11-14T03:17:54Z",
        "createdBy": "spadmin@kube.com",
        "updatedDate": "2023-11-14T03:18:45Z",
        "updatedBy": "spadmin@kube.com",
        "lastPublishedDate": "2023-11-14T03:18:45Z",
        "lastPublishedBy": "spadmin@kube.com",
        "lastPublishedByDisplayName": "SP Admin",
        "isEnterprise": true
      }
    ],
    "scopeId": "8ae7c82a-5f44-4b23-a0c5-748d33883c40",
    "responseTime": {
      "request": 1700129751842,
      "response": 1700129751898,
      "duration": 56
    }
  }
}