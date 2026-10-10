export const accountUsageText = {
    limitsTitle: '使用限额',
    fiveHourWindow: '5 小时',
    weeklyWindow: '每周',
    usedPercent: ({ percent }: { percent: string }) => `已用 ${percent}%`,
    resetTime: ({ time }: { time: string }) => `${time} 重置`,
    limitsEmpty: '尚未收到电脑上的账号限额',
    limitsUnavailable: '限额暂不可用',
    limitsStale: '数据已过期',
};
