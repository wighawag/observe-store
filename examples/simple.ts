import {createObservableStore} from '../src/index.js';

const emitter = createObservableStore({
	user: {
		name: 'John',
		age: 30,
	},
	actions: [
		{
			type: 'increment',
			payload: 1,
		},
	],
	tutorial: {
		seen: false,
	},
});

emitter.on('user:updated', (modification) => {
	console.log('User updated', modification);
});

emitter.on('actions:updated', (modification) => {
	console.log('Actions updated', modification);
});

emitter.on('tutorial:updated', (modification) => {
	console.log('Tutorial updated', modification);
});

emitter.update('user', (user) => {
	user.name = 'Jane';
});

emitter.update('actions', (actions) => {
	actions = [...actions, {type: 'decrement', payload: 1}];
});

emitter.update('actions', (actions) => {
	actions.push({type: 'decrement', payload: 1});
});

emitter.update('actions', (actions) => {
	actions.push(actions[0]);
});

emitter.update('tutorial', (tutorial) => {
	tutorial.seen = true;
});
