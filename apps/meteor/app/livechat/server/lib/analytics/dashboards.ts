import moment from 'moment';
import { LivechatRooms, Users, LivechatVisitors, LivechatAgentActivity } from '@rocket.chat/models';
import type { IUser } from '@rocket.chat/core-typings';

import { settings } from '../../../../settings/server';
import { Livechat } from '../Livechat';
import { secondsToHHMMSS } from '../../../../utils/server';
import {
	findPercentageOfAbandonedRoomsAsync,
	findAllAverageOfChatDurationTimeAsync,
	findAllAverageWaitingTimeAsync,
	findAllNumberOfAbandonedRoomsAsync,
	findAllAverageServiceTimeAsync,
} from './departments';

export const findAllChatsStatusAsync = async ({
	start,
	end,
	departmentId = undefined,
}: {
	start: Date;
	end: Date;
	departmentId?: string;
}) => {
	if (!start || !end) {
		throw new Error('"start" and "end" must be provided');
	}
	return {
		open: await LivechatRooms.countAllOpenChatsBetweenDate({ start, end, departmentId }),
		closed: await LivechatRooms.countAllClosedChatsBetweenDate({ start, end, departmentId }),
		queued: await LivechatRooms.countAllQueuedChatsBetweenDate({ start, end, departmentId }),
		onhold: await LivechatRooms.getOnHoldConversationsBetweenDate(start, end, departmentId),
	};
};

export const getProductivityMetricsAsync = async ({
	start,
	end,
	departmentId = undefined,
	user,
}: {
	start: Date;
	end: Date;
	departmentId?: string;
	user: IUser;
}) => {
	if (!start || !end) {
		throw new Error('"start" and "end" must be provided');
	}
	const totalizers = await Livechat.Analytics.getAnalyticsOverviewData({
		daterange: {
			from: start,
			to: end,
		},
		analyticsOptions: {
			name: 'Productivity',
		},
		departmentId,
		utcOffset: user?.utcOffset,
		language: user?.language || settings.get('Language') || 'en',
	});
	const averageWaitingTime = await findAllAverageWaitingTimeAsync({
		start,
		end,
		departmentId,
	});

	const totalOfWaitingTime = averageWaitingTime.departments.length;

	const sumOfWaitingTime = averageWaitingTime.departments.reduce((acc: number, serviceTime: { averageWaitingTimeInSeconds: number }) => {
		acc += serviceTime.averageWaitingTimeInSeconds;
		return acc;
	}, 0);
	const totalOfAvarageWaitingTime = totalOfWaitingTime === 0 ? 0 : sumOfWaitingTime / totalOfWaitingTime;

	return {
		totalizers: [...totalizers, { title: 'Avg_of_waiting_time', value: secondsToHHMMSS(totalOfAvarageWaitingTime) }],
	};
};

export const getAgentsProductivityMetricsAsync = async ({
	start,
	end,
	departmentId = undefined,
	user,
}: {
	start: Date;
	end: Date;
	departmentId?: string;
	user: IUser;
}) => {
	if (!start || !end) {
		throw new Error('"start" and "end" must be provided');
	}
	// TODO: check type of date
	const averageOfAvailableServiceTime = (
		await LivechatAgentActivity.findAllAverageAvailableServiceTime({
			date: parseInt(moment(start).format('YYYYMMDD')) as any,
			departmentId,
		})
	)[0];
	const averageOfServiceTime = await findAllAverageServiceTimeAsync({
		start,
		end,
		departmentId,
	});
	const totalizers = await Livechat.Analytics.getAnalyticsOverviewData({
		daterange: {
			from: start,
			to: end,
		},
		analyticsOptions: {
			name: 'Conversations',
		},
		departmentId,
		utcOffset: user.utcOffset,
		language: user.language || settings.get('Language') || 'en',
	});

	const totalOfServiceTime = averageOfServiceTime.departments.length;

	const sumOfServiceTime = averageOfServiceTime.departments.reduce(
		(
			acc: number,
			serviceTime: {
				averageServiceTimeInSeconds: number;
			},
		) => {
			acc += serviceTime.averageServiceTimeInSeconds;
			return acc;
		},
		0,
	);
	const totalOfAverageAvailableServiceTime = averageOfAvailableServiceTime
		? averageOfAvailableServiceTime.averageAvailableServiceTimeInSeconds
		: 0;
	const totalOfAverageServiceTime = totalOfServiceTime === 0 ? 0 : sumOfServiceTime / totalOfServiceTime;

	return {
		totalizers: [
			...totalizers.filter((metric: { title: string }) => metric.title === 'Busiest_time'),
			{
				title: 'Avg_of_available_service_time',
				value: secondsToHHMMSS(totalOfAverageAvailableServiceTime),
			},
			{ title: 'Avg_of_service_time', value: secondsToHHMMSS(totalOfAverageServiceTime) },
		],
	};
};

export const getChatsMetricsAsync = async ({ start, end, departmentId = undefined }: { start: Date; end: Date; departmentId?: string }) => {
	if (!start || !end) {
		throw new Error('"start" and "end" must be provided');
	}
	const abandonedRooms = await findAllNumberOfAbandonedRoomsAsync({
		start,
		end,
		departmentId,
	});
	const averageOfAbandonedRooms = await findPercentageOfAbandonedRoomsAsync({
		start,
		end,
		departmentId,
	});
	const averageOfChatDurationTime = await findAllAverageOfChatDurationTimeAsync({
		start,
		end,
		departmentId,
	});

	const totalOfAbandonedRooms = averageOfAbandonedRooms.departments.length;
	const totalOfChatDurationTime = averageOfChatDurationTime.departments.length;

	const sumOfPercentageOfAbandonedRooms = averageOfAbandonedRooms.departments.reduce(
		(
			acc: number,
			abandonedRoom: {
				percentageOfAbandonedChats: number;
			},
		) => {
			acc += abandonedRoom.percentageOfAbandonedChats;
			return acc;
		},
		0,
	);
	const sumOfChatDurationTime = averageOfChatDurationTime.departments.reduce(
		(
			acc: number,
			chatDurationTime: {
				averageChatDurationTimeInSeconds: number;
			},
		) => {
			acc += chatDurationTime.averageChatDurationTimeInSeconds;
			return acc;
		},
		0,
	);
	const totalAbandonedRooms = abandonedRooms.departments.reduce(
		(
			acc: number,
			item: {
				abandonedRooms: number;
			},
		) => {
			acc += item.abandonedRooms;
			return acc;
		},
		0,
	);

	const totalOfAverageAbandonedRooms = totalOfAbandonedRooms === 0 ? 0 : sumOfPercentageOfAbandonedRooms / totalOfAbandonedRooms;
	const totalOfAverageChatDurationTime = totalOfChatDurationTime === 0 ? 0 : sumOfChatDurationTime / totalOfChatDurationTime;

	return {
		totalizers: [
			{ title: 'Total_abandoned_chats', value: totalAbandonedRooms },
			{ title: 'Avg_of_abandoned_chats', value: `${totalOfAverageAbandonedRooms}%` },
			{
				title: 'Avg_of_chat_duration_time',
				value: secondsToHHMMSS(totalOfAverageChatDurationTime),
			},
		],
	};
};

export const getConversationsMetricsAsync = async ({
	start,
	end,
	departmentId,
	user,
}: {
	start: Date;
	end: Date;
	departmentId?: string;
	user: IUser;
}) => {
	if (!start || !end) {
		throw new Error('"start" and "end" must be provided');
	}
	const totalizers = await Livechat.Analytics.getAnalyticsOverviewData({
		daterange: {
			from: start,
			to: end,
		},
		analyticsOptions: {
			name: 'Conversations',
		},
		...(departmentId && departmentId !== 'undefined' && { departmentId }),
		utcOffset: user.utcOffset,
		language: user.language || settings.get('Language') || 'en',
	});
	const metrics = ['Total_conversations', 'Open_conversations', 'On_Hold_conversations', 'Total_messages'];
	const visitorsCount = await LivechatVisitors.getVisitorsBetweenDate({
		start,
		end,
		department: departmentId,
	}).count();
	return {
		totalizers: [
			...totalizers.filter((metric: { title: string }) => metrics.includes(metric.title)),
			{ title: 'Total_visitors', value: visitorsCount },
		],
	};
};

export const findAllChatMetricsByAgentAsync = async ({
	start,
	end,
	departmentId = undefined,
}: {
	start: Date;
	end: Date;
	departmentId?: string;
}) => {
	if (!start || !end) {
		throw new Error('"start" and "end" must be provided');
	}
	const open = await LivechatRooms.countAllOpenChatsByAgentBetweenDate({
		start,
		end,
		departmentId,
	});
	const closed = await LivechatRooms.countAllClosedChatsByAgentBetweenDate({
		start,
		end,
		departmentId,
	});
	const onhold = await LivechatRooms.countAllOnHoldChatsByAgentBetweenDate({
		start,
		end,
		departmentId,
	});

	const result: Record<string, { open: number; closed: number; onhold?: number }> = {};
	(open || []).forEach((agent: { chats: number; _id: string }) => {
		result[agent._id] = { open: agent.chats, closed: 0, onhold: 0 };
	});
	(closed || []).forEach((agent: { _id: string; chats: number }) => {
		result[agent._id] = {
			open: result[agent._id] ? result[agent._id].open : 0,
			closed: agent.chats,
		};
	});

	(onhold || []).forEach((agent: { _id: string; chats: number }) => {
		result[agent._id] = {
			...result[agent._id],
			onhold: agent.chats,
		};
	});
	return result;
};

export const findAllAgentsStatusAsync = async ({ departmentId = undefined }: { departmentId?: string }) =>
	(await Users.countAllAgentsStatus({ departmentId }))[0];

export const findAllChatMetricsByDepartmentAsync = async ({
	start,
	end,
	departmentId = undefined,
}: {
	start: Date;
	end: Date;
	departmentId?: string;
}) => {
	if (!start || !end) {
		throw new Error('"start" and "end" must be provided');
	}
	const open = await LivechatRooms.countAllOpenChatsByDepartmentBetweenDate({
		start,
		end,
		departmentId,
	});
	const closed = await LivechatRooms.countAllClosedChatsByDepartmentBetweenDate({
		start,
		end,
		departmentId,
	});
	const result: Record<string, { open: number; closed: number }> = {};
	(open || []).forEach((department: { name: string; chats: number }) => {
		result[department.name] = { open: department.chats, closed: 0 };
	});
	(closed || []).forEach((department: { name: string; chats: number }) => {
		result[department.name] = {
			open: result[department.name] ? result[department.name].open : 0,
			closed: department.chats,
		};
	});
	return result;
};

export const findAllResponseTimeMetricsAsync = async ({
	start,
	end,
	departmentId = undefined,
}: {
	start: Date;
	end: Date;
	departmentId?: string;
}) => {
	if (!start || !end) {
		throw new Error('"start" and "end" must be provided');
	}
	const responseTimes = (await LivechatRooms.calculateResponseTimingsBetweenDates({ start, end, departmentId }))[0];
	const reactionTimes = (await LivechatRooms.calculateReactionTimingsBetweenDates({ start, end, departmentId }))[0];
	const durationTimings = (await LivechatRooms.calculateDurationTimingsBetweenDates({ start, end, departmentId }))[0];

	return {
		response: {
			avg: responseTimes ? responseTimes.avg : 0,
			longest: responseTimes ? responseTimes.longest : 0,
		},
		reaction: {
			avg: reactionTimes ? reactionTimes.avg : 0,
			longest: reactionTimes ? reactionTimes.longest : 0,
		},
		chatDuration: {
			avg: durationTimings ? durationTimings.avg : 0,
			longest: durationTimings ? durationTimings.longest : 0,
		},
	};
};
