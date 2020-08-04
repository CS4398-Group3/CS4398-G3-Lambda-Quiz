const Alexa = require('ask-sdk-core');
const AWS = require('aws-sdk')
const rdsDataService = new AWS.RDSDataService()

// prepare SQL command
let sqlParamsGetQuestions = {
    secretArn: 'arn:aws:secretsmanager:us-east-1:637995029313:secret:rds-db-credentials/cluster-TX2YL6M77LBJIYZYQYULWL6OTI/admin-1j6vEM',
    resourceArn: 'arn:aws:rds:us-east-1:637995029313:cluster:database-1',
    sql: 'SELECT topicid, questionid, question FROM question;',
    database: 'ExamBot',
    includeResultMetadata: true
}

let sqlParamsGetTopics = {
    secretArn: 'arn:aws:secretsmanager:us-east-1:637995029313:secret:rds-db-credentials/cluster-TX2YL6M77LBJIYZYQYULWL6OTI/admin-1j6vEM',
    resourceArn: 'arn:aws:rds:us-east-1:637995029313:cluster:database-1',
    sql: 'SELECT topicid, topicName FROM topics;',
    database: 'ExamBot',
    includeResultMetadata: true
}

/* INTENT HANDLERS */
const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === `LaunchRequest`;
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder
            .speak(welcomeMessage)
            .reprompt(helpMessage)
            .getResponse();
    },
};

const TopicRequestHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        console.log("Inside TopicRequestHandler");
        console.log(JSON.stringify(request));
        return request.type === "IntentRequest" &&
            (request.intent.name === "TopicIntent");
    },
    async handle(handlerInput) {
        const attributes = handlerInput.attributesManager.getSessionAttributes();
        const response = handlerInput.responseBuilder;
        var results = await queryTopics();

        //results[1].topicname;
        console.log(results);
        console.log(results[1].topicName);
        speechOutput = results[1].topicName;
        var topic = ' ';
        const topicNum = results.length;

        for (var i = 0; i < topicNum; i++) {
            if (i !== topicNum - 1) {
                topic += results[i].topicName + ', '; }
            else {
                topic += 'and ' + results[i].topicName + '.'; }
           // speechOutput = topic;
           //  topic += results[i].topicName + ', ';
            console.log(topic);
            //this.speak(speechOutput);
        }

         speechOutput = topicMessage + topic;
        //speechOutput = topic;

        return response.speak(speechOutput)
            .reprompt(speechOutput)
            .getResponse();

        //return handlerInput.responseBuilder.getResponse();
    },
};

const TopicChoiceHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        console.log("Inside TopicChoiceHandler");
        return request.type === "IntentRequest" &&
            (request.intent.name === "TopicChoiceIntent");
    },
    handle(handlerInput) {
        const response = handlerInput.responseBuilder;
        console.log("Creating choice");
        const choice = handlerInput.requestEnvelope.request.intent.slots;
        console.log(choice);
        // const topicChoice = choice[0].value.toString().toLowerCase();
        //const topicChoice = choice[0].value;
        const topicChoice = getTopic(choice);
        console.log("Inside TopicChoiceHandler - handle");
        console.log(topicChoice);
        //console.log(JSON.stringify(topicChoice));
        chosenTopic = topicChoice.value;
        console.log(chosenTopic);

        speechOutput = topicChoiceMessage + chosenTopic + quizPromptMessage;
        // speechOutput = topicChoice.value;

        return response.speak(speechOutput)
            .reprompt(helpMessage)
            .getResponse();
    },
};

const QuizHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        console.log("Inside QuizHandler");
        console.log(JSON.stringify(request));
        return request.type === "IntentRequest" &&
            (request.intent.name === "StartQuizIntent" || request.intent.name === "AMAZON.StartOverIntent");
    },
    async handle(handlerInput) {
        console.log("Inside QuizHandler - handle");
        console.log(chosenTopic);
        const attributes = handlerInput.attributesManager.getSessionAttributes();
        const response = handlerInput.responseBuilder;
        attributes.state = states.QUIZ;
        attributes.counter = 0;
        attributes.quizScore = 0;


        //var question = askQuestion(handlerInput);
        var results = await queryQuestions();
        var question = results[1].question;
        console.log(question);
        var speakOutput = startQuizMessage + question;
        var repromptOutput = question;

        const item = attributes.quizItem;
        const property = attributes.quizProperty;
/*
        if (supportsDisplay(handlerInput)) {
            const title = `Question #${attributes.counter}`;
            const primaryText = new Alexa.RichTextContentHelper().withPrimaryText(getQuestionWithoutOrdinal(property, item)).getTextContent();
            const itemList = [];
            getAndShuffleMultipleChoiceAnswers(attributes.selectedItemIndex, item, property).forEach((x, i) => {
                itemList.push(
                    {
                        "token": x,
                        "textContent": new Alexa.PlainTextContentHelper().withPrimaryText(x).getTextContent(),
                    }
                );
            });
            response.addRenderTemplateDirective({
                type: 'ListTemplate1',
                token: 'Question',
                backButton: 'hidden',
                title,
                listItems: itemList,
            });
        }
*/
        return response.speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    },
};

const DefinitionHandler = {
    canHandle(handlerInput) {
        console.log("Inside DefinitionHandler");
        const attributes = handlerInput.attributesManager.getSessionAttributes();
        const request = handlerInput.requestEnvelope.request;

        return attributes.state !== states.QUIZ &&
            request.type === 'IntentRequest' &&
            request.intent.name === 'AnswerIntent';
    },
    handle(handlerInput) {
        console.log("Inside DefinitionHandler - handle");
        //GRABBING ALL SLOT VALUES AND RETURNING THE MATCHING DATA OBJECT.
        const item = getItem(handlerInput.requestEnvelope.request.intent.slots);
        const response = handlerInput.responseBuilder;

        //IF THE DATA WAS FOUND
        if (item && item[Object.getOwnPropertyNames(data[0])[0]] !== undefined) {
            if (useCardsFlag) {
                response.withStandardCard(
                    getCardTitle(item),
                    getTextDescription(item))
            }
/*
            if(supportsDisplay(handlerInput)) {
                const title = getCardTitle(item);
                const primaryText = new Alexa.RichTextContentHelper().withPrimaryText(getTextDescription(item, "<br/>")).getTextContent();
                response.addRenderTemplateDirective({
                    type: 'BodyTemplate2',
                    backButton: 'visible',
                    title,
                    textContent: primaryText,
                });
            }
  */
            return response.speak(getSpeechDescription(item))
                .reprompt(repromptSpeech)
                .getResponse();
        }
        //IF THE DATA WAS NOT FOUND
        else
        {
            return response.speak(getBadAnswer(item))
                .reprompt(getBadAnswer(item))
                .getResponse();
        }
    }
};

const QuizAnswerHandler = {
    canHandle(handlerInput) {
        console.log("Inside QuizAnswerHandler");
        const attributes = handlerInput.attributesManager.getSessionAttributes();
        const request = handlerInput.requestEnvelope.request;

        return attributes.state === states.QUIZ &&
            request.type === 'IntentRequest' &&
            request.intent.name === 'AnswerIntent';
    },
    handle(handlerInput) {
        console.log("Inside QuizAnswerHandler - handle");
        const attributes = handlerInput.attributesManager.getSessionAttributes();
        const response = handlerInput.responseBuilder;
        console.log("Received attributes and response");

        let speakOutput = ``;
        let repromptOutput = ``;
        const item = attributes.quizItem;
        const property = attributes.quizProperty;
        const isCorrect = compareSlots(handlerInput.requestEnvelope.request.intent.slots, item[property]);
        console.log("Created isCorrect");

        if (isCorrect) {
            speakOutput = getSpeechCon(true);
            attributes.quizScore += 1;
            handlerInput.attributesManager.setSessionAttributes(attributes);
        } else {
            speakOutput = getSpeechCon(false);
        }

        speakOutput += getAnswer(property, item);
        let question = ``;
        //IF YOUR QUESTION COUNT IS LESS THAN 10, WE NEED TO ASK ANOTHER QUESTION.
        if (attributes.counter < 10) {
            speakOutput += getCurrentScore(attributes.quizScore, attributes.counter);
            question = askQuestion(handlerInput);
            speakOutput += question;
            repromptOutput = question;
/*
            if (supportsDisplay(handlerInput)) {
                const title = `Question #${attributes.counter}`;
                const primaryText = new Alexa.RichTextContentHelper().withPrimaryText(getQuestionWithoutOrdinal(attributes.quizProperty, attributes.quizItem)).getTextContent();
                const itemList = [];
                getAndShuffleMultipleChoiceAnswers(attributes.selectedItemIndex, attributes.quizItem, attributes.quizProperty).forEach((x, i) => {
                    itemList.push(
                        {
                            "token" : x,
                            "textContent" : new Alexa.PlainTextContentHelper().withPrimaryText(x).getTextContent(),
                        }
                    );
                });
                response.addRenderTemplateDirective({
                    type : 'ListTemplate1',
                    token : 'Question',
                    backButton : 'hidden',
                    title,
                    listItems : itemList,
                });
            }

 */
            return response.speak(speakOutput)
                .reprompt(repromptOutput)
                .getResponse();
        }
        else {
            speakOutput += getFinalScore(attributes.quizScore, attributes.counter) + exitSkillMessage;
            /*
            if(supportsDisplay(handlerInput)) {
                const title = 'Thank you for playing';
                const primaryText = new Alexa.RichTextContentHelper().withPrimaryText(getFinalScore(attributes.quizScore, attributes.counter)).getTextContent();
                response.addRenderTemplateDirective({
                    type : 'BodyTemplate1',
                    backButton: 'hidden',
                    title,
                    textContent: primaryText,
                });
            }*/
            return response.speak(speakOutput).getResponse();
        }
    },
};

const RepeatHandler = {
    canHandle(handlerInput) {
        console.log("Inside RepeatHandler");
        const attributes = handlerInput.attributesManager.getSessionAttributes();
        const request = handlerInput.requestEnvelope.request;

        return attributes.state === states.QUIZ &&
            request.type === 'IntentRequest' &&
            request.intent.name === 'AMAZON.RepeatHandler';
    },
    handle(handlerInput) {
        console.log("Inside RepeatHandler - handle");
        const attributes = handlerInput.attributesManager.getSessionAttributes();
        const question = getQuestion(attributes.counter, attributes.quizproperty, attributes.quizitem);

        return handlerInput.responseBuilder
            .speak(question)
            .reprompt(question)
            .getResponse();
    },
};

const HelpHandler = {
    canHandle(handlerInput) {
        console.log("Inside HelpHandler");
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' &&
            request.intent.name === 'AMAZON.HelpHandler';
    },
    handle(handlerInput) {
        console.log("Inside HelpHandler - handle");
        return handlerInput.responseBuilder
            .speak(helpMessage)
            .reprompt(helpMessage)
            .getResponse();
    },
};

const ExitHandler = {
    canHandle(handlerInput) {
        console.log("Inside ExitHandler");
        const attributes = handlerInput.attributesManager.getSessionAttributes();
        const request = handlerInput.requestEnvelope.request;

        return request.type === `IntentRequest` && (
            request.intent.name === 'AMAZON.StopIntent' ||
            request.intent.name === 'AMAZON.PauseIntent' ||
            request.intent.name === 'AMAZON.CancelIntent'
        );
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder
            .speak(exitSkillMessage)
            .getResponse();
    },
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        console.log("Inside SessionEndedRequestHandler");
        return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`Session ended with reason: ${JSON.stringify(handlerInput.requestEnvelope)}`);
        return handlerInput.responseBuilder.getResponse();
    },
};

const ErrorHandler = {
    canHandle() {
        console.log("Inside ErrorHandler");
        return true;
    },
    handle(handlerInput, error) {
        console.log("Inside ErrorHandler - handle");
        console.log(`Error handled: ${JSON.stringify(error)}`);
        console.log(`Handler Input: ${JSON.stringify(handlerInput)}`);

        return handlerInput.responseBuilder
            .speak(helpMessage)
            .reprompt(helpMessage)
            .getResponse();
    },
};

/* CONSTANTS */
const skillBuilder = Alexa.SkillBuilders.custom();
const speechConsCorrect = ['Booya', 'All righty', 'Bam', 'Bazinga', 'Bingo', 'Boom', 'Bravo', 'Cha Ching', 'Cheers', 'Dynomite', 'Hip hip hooray', 'Hurrah', 'Hurray', 'Huzzah', 'Oh dear.  Just kidding.  Hurray', 'Kaboom', 'Kaching', 'Oh snap', 'Phew','Righto', 'Way to go', 'Well done', 'Whee', 'Woo hoo', 'Yay', 'Wowza', 'Yowsa'];
const speechConsWrong = ['Argh', 'Aw man', 'Blarg', 'Blast', 'Boo', 'Bummer', 'Darn', "D'oh", 'Dun dun dun', 'Eek', 'Honk', 'Le sigh', 'Mamma mia', 'Oh boy', 'Oh dear', 'Oof', 'Ouch', 'Ruh roh', 'Shucks', 'Uh oh', 'Wah wah', 'Whoops a daisy', 'Yikes'];

const states = {
    START: `_START`,
    QUIZ: `_QUIZ`,
};

const welcomeMessage = `Welcome to ExamBot!  You can ask me what topics you can study, or you can ask me to start a topic quiz.  What would you like to do?`;
const startQuizMessage = `OK.  I will ask you 10 questions. `;
const exitSkillMessage = `Thank you for using Exam Bot!  Good Luck!`;
const repromptSpeech = `What other topic would you like to Study?`;
const helpMessage = `You can test your knowledge by asking me to start a topic quiz.  What would you like to do?`;
const topicMessage = 'Here are the topics I know: ';
const topicChoiceMessage = 'Okay, I will create a quiz for ';
const quizPromptMessage = '. When you are ready, say start.';
const useCardsFlag = true;

/* SAVED USER INPUTS */
var chosenTopic = '';

/* HELPER FUNCTIONS */

// returns true if the skill is running on a device with a display (show|spot)
function supportsDisplay(handlerInput) {
    var hasDisplay =
        handlerInput.requestEnvelope.context &&
        handlerInput.requestEnvelope.context.System &&
        handlerInput.requestEnvelope.context.System.device &&
        handlerInput.requestEnvelope.context.System.device.supportedInterfaces &&
        handlerInput.requestEnvelope.context.System.device.supportedInterfaces.Display
    return hasDisplay;
}

async function queryQuestions(){
    // run SQL command
    let data = await rdsDataService.executeStatement(sqlParamsGetQuestions).promise()

    var rows = []
    var cols = []

    // build an array of columns
    data.columnMetadata.map((v, i) => {
        cols.push(v.name)
    });

    // build an array of rows: { key=>value }
    data.records.map((r) => {
        var row = {}
        r.map((v, i) => {
            if (v.stringValue !== "undefined") {
                row[cols[i]] = v.stringValue;
            } else if (v.blobValue !== "undefined") {
                row[cols[i]] = v.blobValue;
            } else if (v.doubleValue !== "undefined") {
                row[cols[i]] = v.doubleValue;
            } else if (v.longValue !== "undefined") {
                row[cols[i]] = v.longValue;
            } else if (v.booleanValue !== "undefined") {
                row[cols[i]] = v.booleanValue;
            } else if (v.isNull) {
                row[cols[i]] = null;
            }
        })
        rows.push(row)
    })
    return rows;
}


async function queryTopics(){
    // run SQL command
    let data = await rdsDataService.executeStatement(sqlParamsGetTopics).promise()

    var rows = []
    var cols = []

    // build an array of columns
    data.columnMetadata.map((v, i) => {
        cols.push(v.name)
    });

    // build an array of rows: { key=>value }
    data.records.map((r) => {
        var row = {}
        r.map((v, i) => {
            if (v.stringValue !== "undefined") {
                row[cols[i]] = v.stringValue;
            } else if (v.blobValue !== "undefined") {
                row[cols[i]] = v.blobValue;
            } else if (v.doubleValue !== "undefined") {
                row[cols[i]] = v.doubleValue;
            } else if (v.longValue !== "undefined") {
                row[cols[i]] = v.longValue;
            } else if (v.booleanValue !== "undefined") {
                row[cols[i]] = v.booleanValue;
            } else if (v.isNull) {
                row[cols[i]] = null;
            }
        })
        rows.push(row)
    })
    return rows;
}

function getBadAnswer(item) {
    return `I'm sorry. ${item} is not something I know very much about in this skill. ${helpMessage}`;
}

function getCurrentScore(score, counter) {
    return `Your current score is ${score} out of ${counter}. `;
}

function getFinalScore(score, counter) {
    return `Your final score is ${score} out of ${counter}. `;
}

function getCardTitle(item) {
    return item.StateName;
}

function getTopic(item) {
    return item.Topic;
}

function getSpeechDescription(item) {

    //the Alexa Service will present the correct ordinal (i.e. first, tenth, fifteenth) when the audio response is being delivered
    return `${item.StateName} is the ${item.StatehoodOrder}th state, admitted to the Union in ${item.StatehoodYear}.  The capital of ${item.StateName} is ${item.Capital}, and the abbreviation for ${item.StateName} is <break strength='strong'/><say-as interpret-as='spell-out'>${item.Abbreviation}</say-as>.  I've added ${item.StateName} to your Alexa app.  Which other state or capital would you like to know about?`;
}

function formatCasing(key) {
    return key.split(/(?=[A-Z])/).join(' ');
}

function getQuestion(counter, property, item) {

    //the Alexa Service will present the correct ordinal (i.e. first, tenth, fifteenth) when the audio response is being delivered
    return `Here is your ${counter}th question.  What is the ${formatCasing(property)} of ${item.StateName}?`;
}

// getQuestionWithoutOrdinal returns the question without the ordinal and is
// used for the echo show.
function getQuestionWithoutOrdinal(property, item) {
    return "What is the " + formatCasing(property).toLowerCase() + " of "  + item.StateName + "?";
}

function getAnswer(property, item) {
    switch (property) {
        case 'Abbreviation':
            return `The ${formatCasing(property)} of ${item.StateName} is <say-as interpret-as='spell-out'>${item[property]}</say-as>. `;
        default:
            return `The ${formatCasing(property)} of ${item.StateName} is ${item[property]}. `;
    }
}

function getRandom(min, max) {
    return Math.floor((Math.random() * ((max - min) + 1)) + min);
}

function askQuestion(handlerInput) {
    console.log("I am in askQuestion()");
    //GENERATING THE RANDOM QUESTION FROM DATA
    const random = getRandom(0, data.length - 1);
    const item = data[random];
    const propertyArray = Object.getOwnPropertyNames(item);
    const property = propertyArray[getRandom(1, propertyArray.length - 1)];

    //GET SESSION ATTRIBUTES
    const attributes = handlerInput.attributesManager.getSessionAttributes();

    //SET QUESTION DATA TO ATTRIBUTES
    attributes.selectedItemIndex = random;
    attributes.quizItem = item;
    attributes.quizProperty = property;
    attributes.counter += 1;

    //SAVE ATTRIBUTES
    handlerInput.attributesManager.setSessionAttributes(attributes);

    const question = getQuestion(attributes.counter, property, item);
    return question;
}

function compareSlots(slots, value) {
    for (const slot in slots) {
        if (Object.prototype.hasOwnProperty.call(slots, slot) && slots[slot].value !== undefined) {
            if (slots[slot].value.toString().toLowerCase() === value.toString().toLowerCase()) {
                return true;
            }
        }
    }

    return false;
}

function getItem(slots) {
    const propertyArray = Object.getOwnPropertyNames(data[0]);
    let slotValue;

    for (const slot in slots) {
        if (Object.prototype.hasOwnProperty.call(slots, slot) && slots[slot].value !== undefined) {
            slotValue = slots[slot].value;
            for (const property in propertyArray) {
                if (Object.prototype.hasOwnProperty.call(propertyArray, property)) {
                    const item = data.filter(x => x[propertyArray[property]]
                        .toString().toLowerCase() === slots[slot].value.toString().toLowerCase());
                    if (item.length > 0) {
                        return item[0];
                    }
                }
            }
        }
    }
    return slotValue;
}

function getSpeechCon(type) {
    if (type) return `<say-as interpret-as='interjection'>${speechConsCorrect[getRandom(0, speechConsCorrect.length - 1)]}! </say-as><break strength='strong'/>`;
    return `<say-as interpret-as='interjection'>${speechConsWrong[getRandom(0, speechConsWrong.length - 1)]} </say-as><break strength='strong'/>`;
}


function getTextDescription(item) {
    let text = '';

    for (const key in item) {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
            text += `${formatCasing(key)}: ${item[key]}\n`;
        }
    }
    return text;
}

function getAndShuffleMultipleChoiceAnswers(currentIndex, item, property) {
    return shuffle(getMultipleChoiceAnswers(currentIndex, item, property));
}

// This function randomly chooses 3 answers 2 incorrect and 1 correct answer to
// display on the screen using the ListTemplate. It ensures that the list is unique.
function getMultipleChoiceAnswers(currentIndex, item, property) {

    // insert the correct answer first
    let answerList = [item[property]];

    // There's a possibility that we might get duplicate answers
    // 8 states were founded in 1788
    // 4 states were founded in 1889
    // 3 states were founded in 1787
    // to prevent duplicates we need avoid index collisions and take a sample of
    // 8 + 4 + 1 = 13 answers (it's not 8+4+3 because later we take the unique
    // we only need the minimum.)
    let count = 0
    let upperBound = 12

    let seen = new Array();
    seen[currentIndex] = 1;

    while (count < upperBound) {
        let random = getRandom(0, data.length - 1);

        // only add if we haven't seen this index
        if ( seen[random] === undefined ) {
            answerList.push(data[random][property]);
            count++;
        }
    }

    // remove duplicates from the list.
    answerList = answerList.filter((v, i, a) => a.indexOf(v) === i)
    // take the first three items from the list.
    answerList = answerList.slice(0, 3);
    return answerList;
}

// This function takes the contents of an array and randomly shuffles it.
function shuffle(array) {
    let currentIndex = array.length, temporaryValue, randomIndex;

    while ( 0 !== currentIndex ) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }
    return array;
}



/* LAMBDA SETUP */
exports.handler = skillBuilder
    .addRequestHandlers(
        LaunchRequestHandler,
        TopicRequestHandler,
        TopicChoiceHandler,
        QuizHandler,
        DefinitionHandler,
        QuizAnswerHandler,
        RepeatHandler,
        HelpHandler,
        ExitHandler,
        SessionEndedRequestHandler
    )
    .addErrorHandlers(ErrorHandler)
    .lambda();