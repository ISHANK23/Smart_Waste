import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { utils as XLSXUtils, writeFile as writeXLSX } from 'xlsx';
import apiClient from '../services/apiClient';
import { SyncContext } from './SyncContext';
import { ConnectivityContext } from './ConnectivityContext';
Chart.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);
const RANGE_TO_DAYS = {
  weekly: 7,
  monthly: 30,
  quarterly: 90
};
const PALETTE = ['#0b8a6b', '#0b3d91', '#2f4858', '#16a34a', '#0891b2', '#6366f1'];
const defaultFilters = {
  type: 'all',
  collector: 'all',
  minWeight: '',
  search: '',
  dateFrom: '',
  dateTo: ''
};
const Reports = () => {
  const { data, refresh: refreshSync, loading: syncing, lastSync } = useContext(SyncContext);
  const { online } = useContext(ConnectivityContext);
  const [range, setRange] = useState('monthly');
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [selectedPickups, setSelectedPickups] = useState([]);
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  const [selectedBins, setSelectedBins] = useState([]);
  const [actionMessage, setActionMessage] = useState(null);
  const [actionState, setActionState] = useState('idle');
  const searchRef = useRef(null);
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const { data: analytics } = await apiClient.get('/api/collections/stats', {
        params: { days: RANGE_TO_DAYS[range] }
      });
      setStats(analytics);
    } catch (error) {
      setStatsError(error);
    } finally {
      setStatsLoading(false);
    }
  }, [range]);
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);
  const collectors = useMemo(() => {
    const names = new Set();
    (stats?.breakdown?.byCollector || []).forEach((entry) => {
      if (entry.username) names.add(entry.username);
    });
    (data.collections || []).forEach((record) => {
      if (record.collectedBy?.username) names.add(record.collectedBy.username);
    });
    return Array.from(names);
  }, [data.collections, stats?.breakdown?.byCollector]);
  const filteredCollections = useMemo(() => {
    const records = data?.collections || [];
    const { type, collector, minWeight, search, dateFrom, dateTo } = filters;
    const min = minWeight ? Number(minWeight) : null;
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo) : null;
    return records.filter((record) => {
      const recordType = record.bin?.type || record.type || 'general';
      if (type !== 'all' && recordType !== type) return false;
      if (collector !== 'all' && record.collectedBy?.username !== collector) return false;
      if (min && Number(record.weight || 0) < min) return false;
      if (search) {
        const text = `${record.bin?.binId || ''} ${record.bin?.location || ''} ${record.collectedBy?.username || ''}`.toLowerCase();
        if (!text.includes(search.toLowerCase())) return false;
      }
      if (from || to) {
        const ts = new Date(record.timestamp || record.createdAt);
        if (from && ts < from) return false;
        if (to) {
          const dayEnd = new Date(to);
          dayEnd.setHours(23, 59, 59, 999);
          if (ts > dayEnd) return false;
        }
      }
      return true;
    });
  }, [data?.collections, filters]);
  const pickupRecords = useMemo(() => data?.pickups || [], [data?.pickups]);
  const transactionRecords = useMemo(() => data?.transactions || [], [data?.transactions]);
  const binRecords = useMemo(() => data?.bins || [], [data?.bins]);
  useEffect(() => {
    setSelectedPickups((prev) => prev.filter((id) => pickupRecords.some((pickup) => (pickup._id || pickup.clientReference) === id)));
  }, [pickupRecords]);
  useEffect(() => {
    setSelectedTransactions((prev) =>
      prev.filter((id) => transactionRecords.some((tx) => (tx._id || tx.clientReference) === id))
    );
  }, [transactionRecords]);
  useEffect(() => {
    setSelectedBins((prev) => prev.filter((id) => binRecords.some((bin) => bin._id === id)));
  }, [binRecords]);
  const timelineData = useMemo(() => {
    const series = stats?.series || [];
    const types = new Set();
    series.forEach((entry) => {
      (entry.byType || []).forEach((item) => types.add(item.type || 'general'));
    });
    const labels = series.map((entry) => entry._id);
    const datasets = Array.from(types).map((type, index) => ({
      label: `${type}`.toUpperCase(),
      data: series.map((entry) => {
        const match = (entry.byType || []).find((item) => item.type === type);
        return match ? Number(match.totalWeight || 0) : 0;
      }),
      borderColor: PALETTE[index % PALETTE.length],
      backgroundColor: PALETTE[index % PALETTE.length],
      tension: 0.3,
      fill: false
    }));
    return { labels, datasets };
  }, [stats?.series]);
  const typeBreakdownChart = useMemo(() => {
    const entries = stats?.breakdown?.byType || [];
    return {
      labels: entries.map((item) => (item._id || item.type || 'general').toUpperCase()),
      datasets: [
        {
          data: entries.map((item) => Number(item.totalWeight || 0)),
          backgroundColor: entries.map((_, index) => PALETTE[index % PALETTE.length]),
          borderWidth: 0
        }
      ]
    };
  }, [stats?.breakdown?.byType]);
  const collectorBarChart = useMemo(() => {
    const entries = stats?.breakdown?.byCollector || [];
    return {
      labels: entries.map((item) => item.username || 'Unassigned'),
      datasets: [
        {
          label: 'Total kg collected',
          data: entries.map((item) => Number(item.totalWeight || 0)),
          backgroundColor: '#0b8a6b'
        }
      ]
    };
  }, [stats?.breakdown?.byCollector]);
  const pickupStatusChart = useMemo(() => {
    const summary = stats?.pickups || [];
    const labels = summary.map((item) => (item._id || 'unknown').toUpperCase());
    const dataPoints = summary.map((item) => item.count || 0);
    return {
      labels,
      datasets: [
        {
          label: 'Pickup requests',
          data: dataPoints,
          backgroundColor: labels.map((_, index) => PALETTE[(index + 2) % PALETTE.length])
        }
      ]
    };
  }, [stats?.pickups]);
  const transactionSummary = useMemo(() => {
    const summary = stats?.transactions || [];
    const totals = summary.reduce(
      (acc, item) => {
        acc[item._id || 'unknown'] = {
          count: item.count,
          amount: item.totalAmount
        };
        return acc;
      },
      {}
    );
    return totals;
  }, [stats?.transactions]);
  const criticalBins = stats?.fillLevelInsights?.criticalBins || [];
  const averageFill = stats?.fillLevelInsights?.averageFill || 0;
  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };
  const handleToggleSelection = (type, id) => {
    if (!id) return;
    if (type === 'pickup') {
      setSelectedPickups((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
    } else if (type === 'transaction') {
      setSelectedTransactions((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
    } else if (type === 'bin') {
      setSelectedBins((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
    }
  };
  const handleBulkPickupUpdate = async (status, scheduledDate) => {
    if (selectedPickups.length === 0) return;
    setActionState('working');
    setActionMessage(null);
    try {
      await apiClient.patch('/api/pickups/bulk', {
        ids: selectedPickups,
        status,
        scheduledDate: scheduledDate || undefined
      });
      setActionMessage({ type: 'success', text: `Updated ${selectedPickups.length} pickup request(s).` });
      setSelectedPickups([]);
      await Promise.all([refreshSync(), fetchStats()]);
    } catch (error) {
      setActionMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to update pickup requests.' });
    } finally {
      setActionState('idle');
    }
  };
  const handleBulkTransactionUpdate = async (status) => {
    if (selectedTransactions.length === 0) return;
    setActionState('working');
    setActionMessage(null);
    try {
      await apiClient.patch('/api/transactions/bulk', {
        ids: selectedTransactions,
        status
      });
      setActionMessage({ type: 'success', text: `Updated ${selectedTransactions.length} transaction(s).` });
      setSelectedTransactions([]);
      await Promise.all([refreshSync(), fetchStats()]);
    } catch (error) {
      setActionMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to update transactions.' });
    } finally {
      setActionState('idle');
    }
  };
  const handleBulkBinUpdate = async () => {
    if (selectedBins.length === 0) return;
    setActionState('working');
    setActionMessage(null);
    try {
      await apiClient.patch('/api/bins/bulk', {
        ids: selectedBins,
        currentLevel: 0
      });
      setActionMessage({ type: 'success', text: `Reset fill levels for ${selectedBins.length} bin(s).` });
      setSelectedBins([]);
      await Promise.all([refreshSync(), fetchStats()]);
    } catch (error) {
      setActionMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to update bins.' });
    } finally {
      setActionState('idle');
    }
  };
  const collectionsSheetRows = useMemo(
    () =>
      filteredCollections.map((record) => ({
        Timestamp: new Date(record.timestamp || record.createdAt).toLocaleString(),
        Bin: record.bin?.binId || record.binId,
        Type: record.bin?.type || record.type,
        WeightKg: record.weight,
        Collector: record.collectedBy?.username || 'Unknown',
        Location: record.bin?.location || record.location,
        Distance: record.distanceFromBin != null ? `${record.distanceFromBin}m` : ''
      })),
    [filteredCollections]
  );
  const handleExportExcel = useCallback(() => {
    const workbook = XLSXUtils.book_new();
    const collectionsSheet = XLSXUtils.json_to_sheet(collectionsSheetRows);
    XLSXUtils.book_append_sheet(workbook, collectionsSheet, 'Collections');
    const pickupsSheet = XLSXUtils.json_to_sheet(
      pickupRecords.map((pickup) => ({
        RequestedBy: pickup.user?.username || 'Resident',
        WasteType: pickup.wasteType,
        Status: pickup.status,
        ScheduledDate: pickup.scheduledDate ? new Date(pickup.scheduledDate).toLocaleString() : 'Pending'
      }))
    );
    XLSXUtils.book_append_sheet(workbook, pickupsSheet, 'Pickups');
    const transactionsSheet = XLSXUtils.json_to_sheet(
      transactionRecords.map((tx) => ({
        User: tx.user?.username || 'Resident',
        Type: tx.type,
        Amount: tx.amount,
        Status: tx.status,
        CreatedAt: new Date(tx.createdAt).toLocaleString()
      }))
    );
    XLSXUtils.book_append_sheet(workbook, transactionsSheet, 'Transactions');
    if (criticalBins.length > 0) {
      const binsSheet = XLSXUtils.json_to_sheet(
        criticalBins.map((bin) => ({
          BinId: bin.binId,
          Location: bin.location,
          CurrentLevel: bin.currentLevel,
          Latitude: bin.geoLocation?.latitude,
          Longitude: bin.geoLocation?.longitude
        }))
      );
      XLSXUtils.book_append_sheet(workbook, binsSheet, 'Critical bins');
    }
    const filename = `smart-waste-report-${range}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    writeXLSX(workbook, filename);
  }, [collectionsSheetRows, criticalBins, pickupRecords, range, transactionRecords]);
  const handleExportPDF = useCallback(() => {
    const doc = new jsPDF();
    doc.text('Smart Waste Analytics Summary', 14, 18);
    autoTable(doc, {
      head: [['Metric', 'Value']],
      body: [
        ['Reporting window', `${RANGE_TO_DAYS[range]} days`],
        ['Total collections', stats?.totals?.totalCollections || 0],
        ['Total weight (kg)', stats?.totals?.totalWeight || 0],
        ['Average bin fill (%)', averageFill]
      ],
      startY: 24
    });
    if (criticalBins.length) {
      autoTable(doc, {
        head: [['Bin', 'Location', 'Fill level']],
        body: criticalBins.map((bin) => [bin.binId, bin.location, `${bin.currentLevel || 0}%`]),
        startY: doc.lastAutoTable.finalY + 8
      });
    }
    autoTable(doc, {
      head: [['Collector', 'Collections', 'Total kg']],
      body: (stats?.breakdown?.byCollector || []).map((entry) => [
        entry.username || 'Unknown',
        entry.count || 0,
        Number(entry.totalWeight || 0).toFixed(1)
      ]),
      startY: doc.lastAutoTable.finalY + 8
    });
    const filename = `smart-waste-report-${range}.pdf`;
    doc.save(filename);
  }, [averageFill, criticalBins, range, stats]);
  useEffect(() => {
    const handleKey = (event) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'r') {
        event.preventDefault();
        fetchStats();
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        handleExportExcel();
      }
      if (event.key === '/' && document.activeElement !== searchRef.current) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [fetchStats, handleExportExcel]);
  const pickupStatusOptions = ['pending', 'scheduled', 'completed', 'rejected'];
  const transactionStatusOptions = ['pending', 'paid', 'failed'];
  return (
    <div className="card">
      <div className="card-header">
        <h2>Analytics & Reports</h2>
        <div className="card-actions">
          <button className="primary" type="button" onClick={fetchStats} disabled={statsLoading}>
            {statsLoading ? 'Loading…' : 'Refresh analytics'}
          </button>
          <button className="secondary" type="button" onClick={handleExportPDF}>
            Export PDF
          </button>
          <button className="secondary" type="button" onClick={handleExportExcel}>
            Export Excel
          </button>
        </div>
      </div>
      {!online && <p style={{ color: '#ad6a00' }}>Working offline with cached data. Reconnect to fetch live analytics.</p>}
      <div className="grid grid-2" style={{ marginTop: '1rem' }}>
        <div>
          <label htmlFor="range">Reporting range</label>
          <select id="range" value={range} onChange={(event) => setRange(event.target.value)}>
            <option value="weekly">Last 7 days</option>
            <option value="monthly">Last 30 days</option>
            <option value="quarterly">Last 90 days</option>
          </select>
        </div>
        <div>
          <label htmlFor="search">Quick search</label>
          <input
            id="search"
            ref={searchRef}
            type="search"
            placeholder="Filter by bin, collector, or location"
            value={filters.search}
            onChange={(event) => handleFilterChange('search', event.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-3" style={{ marginTop: '1rem' }}>
        <div>
          <label htmlFor="typeFilter">Bin type</label>
          <select id="typeFilter" value={filters.type} onChange={(event) => handleFilterChange('type', event.target.value)}>
            <option value="all">All</option>
            <option value="general">General</option>
            <option value="recyclable">Recyclable</option>
          </select>
        </div>
        <div>
          <label htmlFor="collectorFilter">Collector</label>
          <select
            id="collectorFilter"
            value={filters.collector}
            onChange={(event) => handleFilterChange('collector', event.target.value)}
          >
            <option value="all">All team members</option>
            {collectors.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="minWeight">Minimum weight (kg)</label>
          <input
            id="minWeight"
            type="number"
            min={0}
            value={filters.minWeight}
            onChange={(event) => handleFilterChange('minWeight', event.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-2" style={{ marginTop: '1rem' }}>
        <div>
          <label htmlFor="dateFrom">Date from</label>
          <input
            id="dateFrom"
            type="date"
            value={filters.dateFrom}
            onChange={(event) => handleFilterChange('dateFrom', event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="dateTo">Date to</label>
          <input
            id="dateTo"
            type="date"
            value={filters.dateTo}
            onChange={(event) => handleFilterChange('dateTo', event.target.value)}
          />
        </div>
      </div>
      <section style={{ marginTop: '1.5rem' }}>
        <h3>Collection trends</h3>
        {statsLoading ? (
          <p>Loading analytics…</p>
        ) : statsError ? (
          <p style={{ color: '#ef4444' }}>Failed to load analytics: {statsError.message || 'Unknown error'}.</p>
        ) : timelineData.labels?.length ? (
          <Line
            data={timelineData}
            options={{
              responsive: true,
              plugins: { legend: { position: 'bottom' } },
              interaction: { mode: 'index', intersect: false },
              scales: { y: { beginAtZero: true } }
            }}
          />
        ) : (
          <p>No collection timeline data for this range.</p>
        )}
      </section>
      <div className="grid" style={{ marginTop: '1.5rem', gap: '1.5rem' }}>
        <div className="card" style={{ background: '#f9fbfd' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Waste type distribution</h3>
          <Doughnut data={typeBreakdownChart} options={{ plugins: { legend: { position: 'bottom' } } }} />
        </div>
        <div className="card" style={{ background: '#f9fbfd' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Collector performance</h3>
          <Bar data={collectorBarChart} options={{ responsive: true, plugins: { legend: { display: false } } }} />
        </div>
        <div className="card" style={{ background: '#f9fbfd' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Pickup pipeline</h3>
          <Bar
            data={pickupStatusChart}
            options={{
              responsive: true,
              scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
              plugins: { legend: { display: false } }
            }}
          />
        </div>
      </div>
      <section style={{ marginTop: '2rem' }}>
        <h3>High priority bins</h3>
        <p>
          Average fill level across the fleet: <strong>{averageFill}%</strong>
        </p>
        {criticalBins.length === 0 ? (
          <p>All monitored bins are below the alert threshold.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th />
                <th>Bin</th>
                <th>Location</th>
                <th>Fill level</th>
                <th>Coordinates</th>
              </tr>
            </thead>
            <tbody>
              {criticalBins.map((bin) => {
                const matching = binRecords.find((item) => item.binId === bin.binId);
                const targetId = matching?._id;
                return (
                  <tr key={bin.binId}>
                    <td>
                      <input
                        type="checkbox"
                        checked={targetId ? selectedBins.includes(targetId) : false}
                        onChange={() => handleToggleSelection('bin', targetId)}
                        disabled={!targetId}
                      />
                    </td>
                    <td>{bin.binId}</td>
                    <td>{bin.location}</td>
                    <td>{bin.currentLevel || 0}%</td>
                    <td>
                      {bin.geoLocation?.latitude && bin.geoLocation?.longitude
                        ? `${bin.geoLocation.latitude.toFixed(4)}, ${bin.geoLocation.longitude.toFixed(4)}`
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {selectedBins.length > 0 && (
          <button
            type="button"
            className="primary"
            style={{ marginTop: '1rem' }}
            onClick={handleBulkBinUpdate}
            disabled={actionState === 'working'}
          >
            Reset fill level for selected bins
          </button>
        )}
      </section>
      <section style={{ marginTop: '2rem' }}>
        <h3>Bulk administrative actions</h3>
        {actionMessage && (
          <p style={{ color: actionMessage.type === 'error' ? '#ef4444' : '#0c7c59' }}>{actionMessage.text}</p>
        )}
        <div className="grid" style={{ gap: '1.5rem' }}>
          <div className="card" style={{ background: '#ffffff' }}>
            <h4>Pickup requests</h4>
            <p>Select requests to update status or schedule.</p>
            <table className="data-table">
              <thead>
                <tr>
                  <th />
                  <th>Resident</th>
                  <th>Waste type</th>
                  <th>Status</th>
                  <th>Scheduled for</th>
                </tr>
              </thead>
              <tbody>
                {pickupRecords.slice(0, 20).map((pickup) => {
                  const id = pickup._id || pickup.clientReference;
                  return (
                    <tr key={id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedPickups.includes(id)}
                          onChange={() => handleToggleSelection('pickup', id)}
                        />
                      </td>
                      <td>{pickup.user?.username || 'Resident'}</td>
                      <td>{pickup.wasteType}</td>
                      <td>{pickup.status}</td>
                      <td>{pickup.scheduledDate ? new Date(pickup.scheduledDate).toLocaleString() : 'Not scheduled'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {selectedPickups.length > 0 && (
              <div className="inline-actions">
                <select
                  id="pickupStatusSelect"
                  defaultValue=""
                  onChange={(event) => {
                    const { value } = event.target;
                    if (value) {
                      handleBulkPickupUpdate(value);
                      event.target.value = '';
                    }
                  }}
                >
                  <option value="">Change status…</option>
                  {pickupStatusOptions.map((option) => (
                    <option key={option} value={option}>
                      Mark as {option}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => handleBulkPickupUpdate('scheduled', new Date().toISOString())}
                  disabled={actionState === 'working'}
                >
                  Schedule for today
                </button>
              </div>
            )}
          </div>
          <div className="card" style={{ background: '#ffffff' }}>
            <h4>Transactions</h4>
            <table className="data-table">
              <thead>
                <tr>
                  <th />
                  <th>User</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactionRecords.slice(0, 20).map((tx) => {
                  const id = tx._id || tx.clientReference;
                  return (
                    <tr key={id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedTransactions.includes(id)}
                          onChange={() => handleToggleSelection('transaction', id)}
                        />
                      </td>
                      <td>{tx.user?.username || 'Resident'}</td>
                      <td>{tx.type}</td>
                      <td>${Number(tx.amount || 0).toFixed(2)}</td>
                      <td>{tx.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {selectedTransactions.length > 0 && (
              <div className="inline-actions">
                <select
                  defaultValue=""
                  onChange={(event) => {
                    const { value } = event.target;
                    if (value) {
                      handleBulkTransactionUpdate(value);
                      event.target.value = '';
                    }
                  }}
                >
                  <option value="">Change status…</option>
                  {transactionStatusOptions.map((option) => (
                    <option key={option} value={option}>
                      Mark as {option}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </section>
      <section style={{ marginTop: '2rem' }}>
        <h3>Filtered collection details</h3>
        <p>
          Showing <strong>{filteredCollections.length}</strong> of {data.collections?.length || 0} records. Last sync:{' '}
          {lastSync ? new Date(lastSync).toLocaleString() : 'not synced yet'}.{' '}
          {syncing && <span style={{ color: '#0b3d91' }}>Syncing latest updates…</span>}
        </p>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Bin</th>
                <th>Type</th>
                <th>Weight (kg)</th>
                <th>Collector</th>
                <th>Distance</th>
              </tr>
            </thead>
            <tbody>
              {filteredCollections.slice(0, 50).map((record) => (
                <tr key={record._id || record.clientReference}>
                  <td>{new Date(record.timestamp || record.createdAt).toLocaleString()}</td>
                  <td>{record.bin?.binId || record.binId}</td>
                  <td>{record.bin?.type || record.type}</td>
                  <td>{Number(record.weight || 0).toFixed(1)}</td>
                  <td>{record.collectedBy?.username || 'Unknown'}</td>
                  <td>{record.distanceFromBin != null ? `${record.distanceFromBin}m` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: '0.85rem', color: '#0a507a', marginTop: '0.5rem' }}>
          Keyboard shortcuts: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> to refresh analytics,{' '}
          <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd> to export, <kbd>/</kbd> to jump to search.
        </p>
      </section>
      <section style={{ marginTop: '2rem' }}>
        <h3>Financial snapshot</h3>
        <div className="grid grid-3">
          {transactionStatusOptions.map((status) => (
            <div key={status} className="stat-card">
              <h4>{status.toUpperCase()}</h4>
              <p>{transactionSummary[status]?.count || 0} transactions</p>
              <p style={{ fontWeight: 600 }}>
                ${Number(transactionSummary[status]?.totalAmount || 0).toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
export default Reports;