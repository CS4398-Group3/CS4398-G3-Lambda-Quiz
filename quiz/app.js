const Alexa = require('ask-sdk-core');
const AWS = require('aws-sdk')
const rdsDataService = new AWS.RDSDataService()


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
        const response = handlerInput.responseBuilder;
        var results = await queryTopics();

        console.log(results);
        console.log(results[1].topicName);
        var topic = ' ';
        const topicNum = results.length;

        for (var i = 0; i < topicNum; i++) {
            if (i !== topicNum - 1) {
                topic += results[i].topicName + ', '; }
            else {
                topic += 'and ' + results[i].topicName + '.'; }
            console.log(topic);
        }

         speechOutput = topicMessage + topic;

        return response.speak(speechOutput)
            .reprompt(speechOutput)
            .getResponse();
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
        const attributes = handlerInput.attributesManager.getSessionAttributes();
        const response = handlerInput.responseBuilder;
        console.log("Inside TopicChoiceHandler - handle");
        console.log("Creating choice");
        const choice = handlerInput.requestEnvelope.request.intent.slots;
        console.log(choice);
        const topicChoice = getTopic(choice);
        console.log(topicChoice);
        //console.log(JSON.stringify(topicChoice));
        attributes.topic = topicChoice.value;
        attributes.topicID = getTopicID(attributes.topic);
        handlerInput.attributesManager.setSessionAttributes(attributes);
        console.log(attributes.topic);
        const speechOutput = topicChoiceMessage + attributes.topic + quizPromptMessage;
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
        const attributes = handlerInput.attributesManager.getSessionAttributes();
        console.log(attributes.topic);
        const response = handlerInput.responseBuilder;
        attributes.state = states.QUIZ;
        attributes.counter = 0;
        attributes.quizScore = 0;

        var results = await queryQuestions(attributes.topicID);
        attributes.results = results;

        var question = attributes.results[attributes.counter].question;
        var speakOutput = startQuizMessage + question;
        var repromptOutput = question;

        handlerInput.attributesManager.setSessionAttributes(attributes);
        return response.speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
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
    async handle(handlerInput) {
        console.log("Inside QuizAnswerHandler - handle");
        const attributes = handlerInput.attributesManager.getSessionAttributes();
        const response = handlerInput.responseBuilder;

        let speakOutput = ``;
        let repromptOutput = ``;
        const isCorrect = compareSlots(handlerInput.requestEnvelope.request.intent.slots, attributes.results[attributes.counter].answer);

        if (isCorrect) {
            speakOutput = getSpeechCon(true);
            attributes.quizScore += 1;
            handlerInput.attributesManager.setSessionAttributes(attributes);
        } else {
            speakOutput = getSpeechCon(false);
        }

        speakOutput += ' The answer was ' + attributes.results[attributes.counter].answer +'.';
        let question = ``;

        //IF YOUR QUESTION COUNT IS LESS THAN 2, WE NEED TO ASK ANOTHER QUESTION.
        if (attributes.counter < 2) {
            attributes.counter += 1;
            speakOutput += getCurrentScore(attributes.quizScore, attributes.counter) + '. ';
            question = attributes.results[attributes.counter].question;
            speakOutput += question;
            repromptOutput = question;
            handlerInput.attributesManager.setSessionAttributes(attributes);

            return response.speak(speakOutput)
                .reprompt(repromptOutput)
                .getResponse();
        }
        else {
            speakOutput += getFinalScore(attributes.quizScore, attributes.counter) + exitSkillMessage;
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
const startQuizMessage = `The first question is `;
const exitSkillMessage = `Thank you for using Exam Bot!  Good Luck!`;
const helpMessage = `You can test your knowledge by asking me to start a quiz.`;
const topicMessage = 'Here are the topics I know: ';
const topicChoiceMessage = 'Okay, I will create a quiz for ';
const quizPromptMessage = '. When you are ready, say start.';

async function queryQuestions(topicID){

    let sqlParamsGetQuestions = {
        secretArn: 'arn:aws:secretsmanager:us-east-1:637995029313:secret:rds-db-credentials/cluster-TX2YL6M77LBJIYZYQYULWL6OTI/admin-1j6vEM',
        resourceArn: 'arn:aws:rds:us-east-1:637995029313:cluster:database-1',
        sql: "SELECT topicid, questionid, question, answer FROM questions where topicid = '" + topicID + "';",
        database: 'ExamBot',
        includeResultMetadata: true
    };
    // run SQL command
    let data = await rdsDataService.executeStatement(sqlParamsGetQuestions).promise();

    var rows = [];
    var cols = [];

    // build an array of columns
    data.columnMetadata.map((v, i) => {
        cols.push(v.name);
    });

    // build an array of rows: { key=>value }
    data.records.map((r) => {
        var row = {}
        r.map((v, i) => {
            if (v.stringValue !== "undefined") {
                row[cols[i]] = v.stringValue;
            } else if (v.intValue !== "undefined") {
                row[cols[i]] = v.intValue;
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
    let sqlParamsGetTopics = {
        secretArn: 'arn:aws:secretsmanager:us-east-1:637995029313:secret:rds-db-credentials/cluster-TX2YL6M77LBJIYZYQYULWL6OTI/admin-1j6vEM',
        resourceArn: 'arn:aws:rds:us-east-1:637995029313:cluster:database-1',
        sql: 'SELECT topicid, topicName FROM topics;',
        database: 'ExamBot',
        includeResultMetadata: true
    }

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
            } else if (v.intValue !== "undefined") {
                row[cols[i]] = v.intValue;
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

function getCurrentScore(score, counter) {
    return `Your current score is ${score} out of ${counter}. `;
}

function getFinalScore(score, counter) {
    return `Your final score is ${score} out of ${counter}. `;
}

function getTopic(item) {
    return item.Topic;
}

function getTopicID(topic) {
    if (topic === 'history') {
        return 1;
    }
    else if (topic === 'math') {
        return 2;
    }
    else if (topic === 'geometry') {
        return 3;
    }
    else {
        return 0;
    }
}

function getRandom(min, max) {
    return Math.floor((Math.random() * ((max - min) + 1)) + min);
}

function compareSlots(slots, value) {
    for (const slot in slots) {
        if (Object.prototype.hasOwnProperty.call(slots, slot) && slots[slot].value !== undefined) {
            console.log("Inside compareSlots with a valid slot value");
            if (slots[slot].value.toString().toLowerCase() === value.toString().toLowerCase()) {
                return true;
            }
        }
    }

    return false;
}

function getSpeechCon(type) {
    if (type) return `<say-as interpret-as='interjection'>${speechConsCorrect[getRandom(0, speechConsCorrect.length - 1)]}! </say-as><break strength='strong'/>`;
    return `<say-as interpret-as='interjection'>${speechConsWrong[getRandom(0, speechConsWrong.length - 1)]} </say-as><break strength='strong'/>`;
}

/* LAMBDA SETUP */
exports.handler = skillBuilder
    .addRequestHandlers(
        LaunchRequestHandler,
        TopicRequestHandler,
        TopicChoiceHandler,
        QuizHandler,
        QuizAnswerHandler,
        RepeatHandler,
        HelpHandler,
        ExitHandler,
        SessionEndedRequestHandler
    )
    .addErrorHandlers(ErrorHandler)
    .lambda();