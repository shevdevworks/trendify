export const mockData = {
  day: {
    revenue: { value: '$420K', trend: '+1.5%', isPositive: true },
    orders: { value: '124', trend: '+0.8%', isPositive: true },
    averageCheck: { value: '$3,387', trend: '+2.1%', isPositive: true },
    margin: { value: '31.2%', trend: '-0.4%', isPositive: false },
    table: [
      { id: '#1024', date: '14:20', product: 'Apex Chrono Smartwatch', platform: 'Amazon', price: '$12,500', status: 'Delivered' },
      { id: '#1023', date: '11:05', product: 'SoundByte Wireless Buds', platform: 'eBay', price: '$4,200', status: 'In Transit' },
      { id: '#1022', date: '09:45', product: 'iPhone Pro Case', platform: 'AliExpress', price: '$1,990', status: 'Delivered' },
      { id: '#1021', date: '08:15', product: 'HomePod Mini', platform: 'Amazon', price: '$7,800', status: 'Cancelled' },
      { id: '#1020', date: '07:30', product: 'MacBook Pro Sleeve', platform: 'Amazon', price: '$3,400', status: 'Delivered' },
      { id: '#1019', date: '06:15', product: 'Neon Mechanic Keyboard', platform: 'eBay', price: '$18,900', status: 'Delivered' },
      { id: '#1018', date: '05:40', product: 'USB-C Multi-Hub Platinum', platform: 'Amazon', price: '$5,200', status: 'In Transit' },
      { id: '#1017', date: '04:10', product: 'Graphene Wireless Charger', platform: 'AliExpress', price: '$3,100', status: 'Delivered' },
      { id: '#1016', date: '03:25', product: 'Ergonomic Desk Mouse', platform: 'Amazon', price: '$8,400', status: 'Delivered' },
      { id: '#1015', date: '02:02', product: 'Aero Cooling Stand v2', platform: 'eBay', price: '$6,700', status: 'Cancelled' },
      { id: '#1014', date: '01:15', product: 'Studio Monitor Speakers', platform: 'Amazon', price: '$45,000', status: 'Delivered' },
      { id: '#1013', date: '00:45', product: '4K Ultra-Sharp Display', platform: 'AliExpress', price: '$98,000', status: 'In Transit' }
    ],
    charts: {
      trend: [30, 45, 35, 60, 40, 70, 85, 65, 90, 80, 95, 110],
      trendLabels: ['02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '00:00'],
      platformDistribution: [55, 25, 20]
    }
  },
  week: {
    revenue: { value: '$2.8M', trend: '+6.1%', isPositive: true },
    orders: { value: '842', trend: '+4.3%', isPositive: true },
    averageCheck: { value: '$3,325', trend: '+1.8%', isPositive: true },
    margin: { value: '32.8%', trend: '+0.5%', isPositive: true },
    table: [
      { id: '#0940', date: 'Mon', product: 'Titanium Drone Core', platform: 'Amazon', price: '$145,000', status: 'Delivered' },
      { id: '#0939', date: 'Mon', product: 'VR Headset Optima', platform: 'eBay', price: '$32,000', status: 'Delivered' },
      { id: '#0938', date: 'Tue', product: 'Micro-LED Panel 32', platform: 'AliExpress', price: '$54,000', status: 'In Transit' },
      { id: '#0937', date: 'Wed', product: 'Liquid Cooling Block', platform: 'Amazon', price: '$12,500', status: 'Delivered' },
      { id: '#0936', date: 'Wed', product: 'Quantum SSD 2TB', platform: 'eBay', price: '$41,000', status: 'Cancelled' },
      { id: '#0935', date: 'Thu', product: 'Smart Hub Controller', platform: 'Amazon', price: '$22,400', status: 'Delivered' },
      { id: '#0934', date: 'Thu', product: 'Carbon Case Bundle', platform: 'AliExpress', price: '$8,900', status: 'Delivered' },
      { id: '#0933', date: 'Fri', product: 'Haptic Gaming Vest', platform: 'eBay', price: '$67,000', status: 'In Transit' },
      { id: '#0932', date: 'Fri', product: 'AI Camera Sensor Module', platform: 'Amazon', price: '$112,000', status: 'Delivered' },
      { id: '#0931', date: 'Sat', product: 'Modular Power Supply', platform: 'AliExpress', price: '$19,500', status: 'Delivered' },
      { id: '#0930', date: 'Sun', product: 'Macro Pad Console', platform: 'eBay', price: '$14,000', status: 'Delivered' },
      { id: '#0929', date: 'Sun', product: 'Pro Audio Interface', platform: 'Amazon', price: '$38,000', status: 'In Transit' }
    ],
    charts: {
      trend: [320, 410, 380, 490, 520, 460, 610],
      trendLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      platformDistribution: [48, 32, 20]
    }
  },
  month: {
    revenue: { value: '$12.4M', trend: '+14.2%', isPositive: true },
    orders: { value: '3,741', trend: '+9.5%', isPositive: true },
    averageCheck: { value: '$3,314', trend: '+4.3%', isPositive: true },
    margin: { value: '33.5%', trend: '+1.2%', isPositive: true },
    table: [
      { id: '#0850', date: '06-01', product: 'Enterprise Server Node v4', platform: 'Amazon', price: '$450,000', status: 'Delivered' },
      { id: '#0849', date: '06-03', product: 'Carbon Fiber Drone X', platform: 'eBay', price: '$85,000', status: 'In Transit' },
      { id: '#0848', date: '06-05', product: 'Liquid Cooling Kit Bundle', platform: 'AliExpress', price: '$14,300', status: 'Delivered' },
      { id: '#0847', date: '06-10', product: 'Pro Audio Mixer Console', platform: 'Amazon', price: '$92,000', status: 'Delivered' },
      { id: '#0846', date: '06-12', product: 'Graphene Battery Pack', platform: 'AliExpress', price: '$22,000', status: 'Cancelled' },
      { id: '#0845', date: '06-14', product: 'Neural Net Accelerator PCI', platform: 'Amazon', price: '$290,000', status: 'Delivered' },
      { id: '#0844', date: '06-17', product: 'Optic Fiber Transceiver 100G', platform: 'eBay', price: '$64,000', status: 'Delivered' },
      { id: '#0843', date: '06-19', product: 'Waterproof Field Monitor', platform: 'AliExpress', price: '$41,500', status: 'In Transit' },
      { id: '#0842', date: '06-22', product: 'Biometric Security Scanner', platform: 'Amazon', price: '$115,000', status: 'Delivered' },
      { id: '#0841', date: '06-24', product: 'Ultra-Dense Storage Array', platform: 'eBay', price: '$380,000', status: 'Cancelled' },
      { id: '#0840', date: '06-26', product: 'Thermal Imaging Camera Module', platform: 'AliExpress', price: '$73,000', status: 'Delivered' },
      { id: '#0839', date: '06-28', product: 'Ruggedized Compute Node', platform: 'Amazon', price: '$210,000', status: 'In Transit' }
    ],
    charts: {
      trend: [1.8, 2.4, 2.1, 2.9, 3.4, 3.1, 4.2, 3.9, 4.8, 5.5, 5.1, 6.4],
      trendLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      platformDistribution: [42, 38, 20]
    }
  }
};

/**
 * Simulates an async API request to fetch dashboard telemetry data.
 * @param {string} period - 'day' | 'week' | 'month'
 * @returns {Promise<Object>}
 */
export function fetchDashboardData(period) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockData[period] || mockData.month);
    }, 250);
  });
}