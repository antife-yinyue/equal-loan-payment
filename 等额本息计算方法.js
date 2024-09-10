function calculate(贷款额, 贷款月数, 还款阶段, { silence = false } = {}) {
  const table = {};
  const 总计还款 = { 累计月供: 0, 累计本金: 0, 累计利息: 0 };
  let 累计还款月数 = 0;
  let 月利率;

  for (let i = 0; i < 还款阶段.length; i++) {
  	if (贷款额 <= 0 || 贷款月数 <= 0) break;
    
    let [当前阶段起始时间, 当前阶段] = 还款阶段[i];
    月利率 = 当前阶段.年利率 ? 当前阶段.年利率 / 12 / 100 : 月利率;
    const { D: 提前还款日期 } = deDate(当前阶段起始时间);
    let 提前还款日期之前的月供, 提前还款日期之前的月息;

  	if (当前阶段.提前还款) {
      总计还款.累计月供 += 当前阶段.提前还款;
      总计还款.累计本金 += 当前阶段.提前还款;
    	table[`${当前阶段起始时间} (提前还款)`] = new Row({
        月供: 当前阶段.提前还款,
        本金: 当前阶段.提前还款,
        利息: 0,
      });
      
      // 提前还款当月的利息按还款日期分割为上下两部分
      提前还款日期之前的月供 = monthlyRepayment(贷款额, 月利率, 贷款月数);
      提前还款日期之前的月息 = calcMonthlyInterest(贷款额, 月利率, 提前还款日期之前的月供)(1);

      // 重置当前阶段起始时间
      if (提前还款日期 > 还款日) {
        const d = new Date(当前阶段起始时间);
        d.setMonth(d.getMonth() + 1);
        当前阶段起始时间 = deDate(d).YM;
      }

      // 扣减待还本金
  		贷款额 -= 当前阶段.提前还款;
    	// 缩短贷款年限
      if (当前阶段.总贷款月数缩短) 贷款月数 -= 当前阶段.总贷款月数缩短;
    }

    const 月供 = monthlyRepayment(贷款额, 月利率, 贷款月数);
    const monthlyInterest = calcMonthlyInterest(贷款额, 月利率, 月供);
    let 当前阶段月数 = 贷款月数;

    if (i < 还款阶段.length - 1) {
      const [下个阶段起始时间, 下个阶段] = 还款阶段[i + 1];
      当前阶段月数 = diffInMonths(当前阶段起始时间, 下个阶段起始时间);
    	if (下个阶段.提前还款 && deDate(下个阶段起始时间).D > 还款日) 当前阶段月数++; // 提前还款当月计入上一阶段
    }

    for (let N = 1; N <= 当前阶段月数; N++) {
      if (贷款额 <= 0 || 贷款月数 <= 0) break;

      let 月息 = monthlyInterest(N);

      // 提前还款当月的利息需要分段计算，提前还款当天计入下半段
      if (N === 1 && 当前阶段.提前还款) {
        const 上半段利息 = 提前还款日期之前的月息 / 30 * (提前还款日期 - 1);
        const 下半段利息 = 月息 / 30 * (30 - 提前还款日期 + 1);
      	月息 = 上半段利息 + 下半段利息;
      }

    	let 本月月供 = 月供;
      let 本月本金 = 月供 - 月息;
      let 本月利息 = 月息;

      if (N === 1 && 当前阶段.重置本金) {
        本月本金 = 当前阶段.重置本金; // 重置后的本金需要在贷款额中扣减掉
        本月月供 = 本月本金 + 本月利息;
      }
      if (N === 1 && 当前阶段.重置月息) {
        本月利息 = 当前阶段.重置月息; // 重置后的月息不会影响当月本金的计算
        本月月供 = 本月本金 + 本月利息;
      }

      贷款额 -= 本月本金;
      贷款月数--;

      table[genKey(当前阶段起始时间, N)] = new Row({ 本月月供, 本月本金, 本月利息 });

      总计还款.累计月供 += 本月月供;
      总计还款.累计本金 += 本月本金;
      总计还款.累计利息 += 本月利息;
      累计还款月数++;

      if (N === 1 && 当前阶段.断点 && !silence) {
        console.warn(
          '截止', 当前阶段起始时间, '已累计还款', 累计还款月数, '个月:',
          formatCurrency({ ...总计还款 }),
          '剩余待还本金:', formatCurrency(总贷款额 - 总计还款.累计本金)
        );
      }
    }
  }

  table['总计'] = new Row(总计还款);

  return {
    ...总计还款,
    table,
  };
}

function monthlyRepayment(贷款额, 月利率, 贷款月数) {
  return toNumber(
    贷款额 * 月利率 * Math.pow(1 + 月利率, 贷款月数) / (Math.pow(1 + 月利率, 贷款月数) - 1)
  );
}

function calcMonthlyInterest(贷款额, 月利率, 月供) {
  return 第N个还款月 => toNumber(
    (贷款额 * 月利率 - 月供) * Math.pow(1 + 月利率, 第N个还款月 - 1) + 月供
  );
}

function toNumber(s) {
  return Number(s.toFixed(2));
}

function diffInMonths(d1, d2) {
  const {Y: y1, M: m1} = deDate(d1);
  const {Y: y2, M: m2} = deDate(d2);
  return 12 * (y2 - y1) + (m2 - m1);
}

function deDate(s) {
  const date = new Date(s);
  const Y = date.getFullYear();
  const M = date.getMonth() + 1;
  const D = date.getDate();
  return {
    Y,
    M,
    D,
    YM: Y + '-' + M,
  };
}

function Row(columns) {
  for (let k in columns) {
    this[k.slice(-2)] = formatCurrency(columns[k]);
  }
}

function formatCurrency(s) {
  const formatter = Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
  });
  if (typeof s === 'number') return formatter.format(s);

  for (let k in s) {
    s[k] = formatter.format(s[k]);
  }
  return s;
}

function genKey(D, N) {
  const date = new Date(D);
  date.setMonth(date.getMonth() + (N - 1));
  return `${date.getFullYear()}-${date.getMonth() + 1}`;
}
