import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Spinner,
  Tabs,
  Tab,
  Input
} from '@heroui/react';
import {
  Zap,
  Droplet,
  Calendar
} from 'lucide-react';
import { api } from '@/lib/api';

type DeviceReport = {
  deviceId: string;
  deviceName?: string;
  deviceLocation?: string;
  totalEnergy: number;
  totalWater: number;
  hours?: number;
  days?: Array<{ date: string; energy: number; water: number }>;
  daysCount?: number;
};

type DailyReport = {
  date: string;
  devices: DeviceReport[];
  totalEnergy: number;
  totalWater: number;
};

type WeeklyReport = {
  weekStart: string;
  weekEnd: string;
  devices: DeviceReport[];
  totalEnergy: number;
  totalWater: number;
};

type MonthlyReport = {
  month: string;
  devices: DeviceReport[];
  totalEnergy: number;
  totalWater: number;
};

type YearlyReport = {
  year: string;
  devices: DeviceReport[];
  totalEnergy: number;
  totalWater: number;
};

export const Reports: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('daily');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Daily report
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [dailyDate, setDailyDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // Weekly report
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(today.setDate(diff));
    return monday.toISOString().slice(0, 10);
  });

  // Monthly report
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(
    null
  );
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  // Yearly report
  const [yearlyReport, setYearlyReport] = useState<YearlyReport | null>(null);
  const [year, setYear] = useState(new Date().getFullYear().toString());

  const loadDailyReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getDailyReport(dailyDate);
      setDailyReport(data);
    } catch (err: any) {
      setError(err.response?.data?.message || t('reports.loadError'));
    } finally {
      setLoading(false);
    }
  }, [dailyDate, t]);

  const loadWeeklyReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getWeeklyReport(weekStart);
      setWeeklyReport(data);
    } catch (err: any) {
      setError(err.response?.data?.message || t('reports.loadError'));
    } finally {
      setLoading(false);
    }
  }, [weekStart, t]);

  const loadMonthlyReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getMonthlyReport(month);
      setMonthlyReport(data);
    } catch (err: any) {
      setError(err.response?.data?.message || t('reports.loadError'));
    } finally {
      setLoading(false);
    }
  }, [month, t]);

  const loadYearlyReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getYearlyReport(year);
      setYearlyReport(data);
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || t('reports.loadError');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [year, t]);

  useEffect(() => {
    if (activeTab === 'daily') {
      loadDailyReport();
    } else if (activeTab === 'weekly') {
      loadWeeklyReport();
    } else if (activeTab === 'monthly') {
      loadMonthlyReport();
    } else if (activeTab === 'yearly') {
      loadYearlyReport();
    }
  }, [
    activeTab,
    loadDailyReport,
    loadWeeklyReport,
    loadMonthlyReport,
    loadYearlyReport
  ]);


  const renderDeviceCard = (device: DeviceReport) => (
    <Card key={device.deviceId} className="premium-card">
      <CardHeader className="pb-2">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {device.deviceName || 'Unknown Device'}
          </h3>
          {device.deviceLocation && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {device.deviceLocation}
            </p>
          )}
        </div>
      </CardHeader>
      <CardBody className="pt-0">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-warning" />
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {t('reports.energy')}
              </p>
              <p className="text-sm font-semibold">
                {device.totalEnergy.toFixed(2)} kWh
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Droplet className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {t('reports.water')}
              </p>
              <p className="text-sm font-semibold">
                {device.totalWater.toFixed(2)} L
              </p>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(key as string)}
          className="mb-6"
        >
          <Tab key="daily" title={t('reports.daily')}>
            <div className="space-y-4">
              <div className="flex gap-4 items-end">
                <Input
                  type="date"
                  label={t('reports.selectDate')}
                  value={dailyDate}
                  onChange={(e) => setDailyDate(e.target.value)}
                  variant="bordered"
                />
                <Button
                  color="primary"
                  className="text-white"
                  onPress={loadDailyReport}
                  isLoading={loading}
                >
                  {t('reports.load')}
                </Button>
              </div>

              {error && (
                <Card className="mb-4">
                  <CardBody>
                    <p className="text-danger text-sm">{error}</p>
                  </CardBody>
                </Card>
              )}

              {loading ? (
                <div className="flex justify-center py-12">
                  <Spinner size="lg" color="primary" />
                </div>
              ) : dailyReport ? (
                <>
                  <Card className="premium-card mb-4">
                    <CardBody>
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold">{t('reports.daily')} {t('reports.title')}</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-lg bg-warning/10">
                            <Zap className="w-6 h-6 text-warning" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {t('reports.totalEnergy')}
                            </p>
                            <p className="text-xl font-bold">
                              {dailyReport.totalEnergy.toFixed(2)} kWh
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-lg bg-primary/10">
                            <Droplet className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {t('reports.totalWater')}
                            </p>
                            <p className="text-xl font-bold">
                              {dailyReport.totalWater.toFixed(2)} L
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardBody>
                  </Card>

                  {dailyReport.devices.length > 0 ? (
                    <div className="space-y-4">
                      {dailyReport.devices.map(renderDeviceCard)}
                    </div>
                  ) : (
                    <Card>
                      <CardBody className="text-center py-12">
                        <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <p className="text-gray-600 dark:text-gray-400">
                          {t('reports.noData')}
                        </p>
                      </CardBody>
                    </Card>
                  )}
                </>
              ) : null}
            </div>
          </Tab>

          <Tab key="weekly" title={t('reports.weekly')}>
            <div className="space-y-4">
              <div className="flex gap-4 items-end">
                <Input
                  type="date"
                  label={t('reports.selectWeekStart')}
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                  variant="bordered"
                />
                <Button
                  color="primary"
                  onPress={loadWeeklyReport}
                  isLoading={loading}
                >
                  {t('reports.load')}
                </Button>
              </div>

              {error && (
                <Card className="mb-4">
                  <CardBody>
                    <p className="text-danger text-sm">{error}</p>
                  </CardBody>
                </Card>
              )}

              {loading ? (
                <div className="flex justify-center py-12">
                  <Spinner size="lg" color="primary" />
                </div>
              ) : weeklyReport ? (
                <>
                  <Card className="premium-card mb-4">
                    <CardBody>
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold">{t('reports.weekly')} {t('reports.title')}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {t('reports.weekPeriod')}: {weeklyReport.weekStart} -{' '}
                          {weeklyReport.weekEnd}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-lg bg-warning/10">
                            <Zap className="w-6 h-6 text-warning" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {t('reports.totalEnergy')}
                            </p>
                            <p className="text-xl font-bold">
                              {weeklyReport.totalEnergy.toFixed(2)} kWh
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-lg bg-primary/10">
                            <Droplet className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {t('reports.totalWater')}
                            </p>
                            <p className="text-xl font-bold">
                              {weeklyReport.totalWater.toFixed(2)} L
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardBody>
                  </Card>

                  {weeklyReport.devices.length > 0 ? (
                    <div className="space-y-4">
                      {weeklyReport.devices.map(renderDeviceCard)}
                    </div>
                  ) : (
                    <Card>
                      <CardBody className="text-center py-12">
                        <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <p className="text-gray-600 dark:text-gray-400">
                          {t('reports.noData')}
                        </p>
                      </CardBody>
                    </Card>
                  )}
                </>
              ) : null}
            </div>
          </Tab>

          <Tab key="monthly" title={t('reports.monthly')}>
            <div className="space-y-4">
              <div className="flex gap-4 items-end">
                <Input
                  type="month"
                  label={t('reports.selectMonth')}
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  variant="bordered"
                />
                <Button
                  color="primary"
                  onPress={loadMonthlyReport}
                  isLoading={loading}
                >
                  {t('reports.load')}
                </Button>
              </div>

              {error && (
                <Card className="mb-4">
                  <CardBody>
                    <p className="text-danger text-sm">{error}</p>
                  </CardBody>
                </Card>
              )}

              {loading ? (
                <div className="flex justify-center py-12">
                  <Spinner size="lg" color="primary" />
                </div>
              ) : monthlyReport ? (
                <>
                  <Card className="premium-card mb-4">
                    <CardBody>
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold">{t('reports.monthly')} {t('reports.title')}</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-lg bg-warning/10">
                            <Zap className="w-6 h-6 text-warning" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {t('reports.totalEnergy')}
                            </p>
                            <p className="text-xl font-bold">
                              {monthlyReport.totalEnergy.toFixed(2)} kWh
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-lg bg-primary/10">
                            <Droplet className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {t('reports.totalWater')}
                            </p>
                            <p className="text-xl font-bold">
                              {monthlyReport.totalWater.toFixed(2)} L
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardBody>
                  </Card>

                  {monthlyReport.devices.length > 0 ? (
                    <div className="space-y-4">
                      {monthlyReport.devices.map(renderDeviceCard)}
                    </div>
                  ) : (
                    <Card>
                      <CardBody className="text-center py-12">
                        <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <p className="text-gray-600 dark:text-gray-400">
                          {t('reports.noData')}
                        </p>
                      </CardBody>
                    </Card>
                  )}
                </>
              ) : null}
            </div>
          </Tab>

          <Tab key="yearly" title={t('reports.yearly')}>
            <div className="space-y-4">
              <div className="flex gap-4 items-end">
                <Input
                  type="number"
                  label={t('reports.selectYear')}
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  variant="bordered"
                  min="2020"
                  max="2099"
                />
                <Button
                  color="primary"
                  onPress={loadYearlyReport}
                  isLoading={loading}
                >
                  {t('reports.load')}
                </Button>
              </div>

              {error && (
                <Card className="mb-4">
                  <CardBody>
                    <p className="text-danger text-sm">{error}</p>
                  </CardBody>
                </Card>
              )}

              {loading ? (
                <div className="flex justify-center py-12">
                  <Spinner size="lg" color="primary" />
                </div>
              ) : yearlyReport ? (
                <>
                  <Card className="premium-card mb-4">
                    <CardBody>
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold">{t('reports.yearly')} {t('reports.title')}</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-lg bg-warning/10">
                            <Zap className="w-6 h-6 text-warning" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {t('reports.totalEnergy')}
                            </p>
                            <p className="text-xl font-bold">
                              {yearlyReport.totalEnergy.toFixed(2)} kWh
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-lg bg-primary/10">
                            <Droplet className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {t('reports.totalWater')}
                            </p>
                            <p className="text-xl font-bold">
                              {yearlyReport.totalWater.toFixed(2)} L
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardBody>
                  </Card>

                  {yearlyReport.devices.length > 0 ? (
                    <div className="space-y-4">
                      {yearlyReport.devices.map(renderDeviceCard)}
                    </div>
                  ) : (
                    <Card>
                      <CardBody className="text-center py-12">
                        <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <p className="text-gray-600 dark:text-gray-400">
                          {t('reports.noData')}
                        </p>
                      </CardBody>
                    </Card>
                  )}
                </>
              ) : null}
            </div>
          </Tab>
        </Tabs>
      </div>
    </div>
  );
};
