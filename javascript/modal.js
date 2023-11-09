var modalRectDataArray = [];
var modalPaper;
var modalGraph;
var modalCells = [];
var modalElements = [];
var modalLinks = [];
var modalControls;
var modalTitleLabel;


// create modal
let modalTarget = document.getElementById('branchModal');

// add events
modalTarget.addEventListener('show.bs.modal', function (event) {

    $('#modalTitleLabel').text(modalTitleLabel);

    modalPaper = createPaper("modalCanvasHolder");
    modalGraph = modalPaper.model;
    modalCells = createCells(modalElements, modalLinks, modalRectDataArray);
    createLayoutControl('modalLayoutControls', modalPaper,modalGraph,modalCells);

    setTimeout(() => {
        modalControls.layout();
    }, 500);

})

modalTarget.addEventListener('hidden.bs.modal', function (event) {
    resetModal();
})

// with this, we can use modal.show() to manually trigger it in javascript
let modal = new bootstrap.Modal(modalTarget, {
    keyboard: true,
    backdrop: 'static',
    focus: false
})


// parallelSet get from manCanvas.js within createLayoutControl function
function createModalStageData(parallelSet) {

    for (let i = 0; i < parallelSet.parallelStages.length; i++) {
        let stage = parallelSet.parallelStages[i];
        let currentStageName = stage.title.key;
        let currentStageId = stage.workflowStageId;
        let nextStages = [];
        let preStages = [];
        let branches = [];
        let isEndStage = stage.isEndStage;
        let isApprovedStage = stage.isApprovedStage;
        let seqNo = stage.seqNo;
        let hasDecision = false;
        let stageType = stage.stageType;

        let actionLength = stage.actions.length;

        // get nextStage data
        for (let j = 0; j < actionLength; j++) {
            let stageName = stage.actions[j].eventLists[0].events[0].stageTitle.title.key;
            let actionName = stage.actions[j].title.key;
            let stageId = stage.actions[j].eventLists[0].events[0].workflowStageId;
            nextStages.push({ stageName, actionName, stageId });
        }

        modalRectDataArray.push({
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
        });

    }

}

function resetModal() {

    modalRectDataArray = [];
    modalElements = [];
    modalLinks = [];
    modalPaper="";

}

const modalScaleDragger = document.getElementById("modalScaleDragger");
modalScaleDragger.addEventListener("input", () => {
    const value = $("#modalScaleDragger").val();
    modalPaper.scale(value);
});

