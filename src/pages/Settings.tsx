import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Card,
  CardBody,
  CardHeader,
  Divider,
  Select,
  SelectItem,
} from '@heroui/react'
import { Palette, Globe } from 'lucide-react'
import { useThemeStore, PREMIUM_COLORS, type ColorKey } from '@/store/themeStore'
import { useLanguageStore } from '@/store/languageStore'
import { motion } from 'framer-motion'

export const Settings: React.FC = () => {
  const { t } = useTranslation()
  const { primaryColor, setPrimaryColor, loadTheme } = useThemeStore()
  const { language, setLanguage } = useLanguageStore()

  useEffect(() => {
    loadTheme()
  }, [loadTheme])

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Primary Color */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3 }}
        >
          <Card className="premium-card">
            <CardHeader className="flex items-center gap-3 pb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Palette className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('settings.primaryColor')}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('settings.primaryColorDescription')}
                </p>
              </div>
            </CardHeader>
            <Divider />
            <CardBody className="pt-6">
              <div className="space-y-4">
                <Select
                  label={t('settings.selectColor')}
                  selectedKeys={[primaryColor]}
                  onSelectionChange={(keys) => {
                    const color = Array.from(keys)[0] as ColorKey
                    if (color) {
                      setPrimaryColor(color)
                    }
                  }}
                  variant="bordered"
                  classNames={{
                    trigger: 'bg-white dark:bg-gray-800',
                  }}
                >
                  {Object.entries(PREMIUM_COLORS).map(([key, color]) => (
                    <SelectItem key={key}>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600"
                          style={{ backgroundColor: color.value }}
                        />
                        <span>{color.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </Select>

                {/* Color Preview */}
                <div className="flex flex-wrap gap-3 pt-2">
                  {Object.entries(PREMIUM_COLORS).map(([key, color]) => (
                    <button
                      key={key}
                      onClick={() => setPrimaryColor(key as ColorKey)}
                      className={`w-12 h-12 rounded-lg border-2 transition-all ${
                        primaryColor === key
                          ? 'border-primary scale-110 shadow-lg'
                          : 'border-gray-300 dark:border-gray-600 hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.value }}
                      aria-label={`Select ${color.name} color`}
                    />
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>
        </motion.div>

        {/* Language */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="premium-card">
            <CardHeader className="flex items-center gap-3 pb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Globe className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('settings.language')}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('settings.languageDescription')}
                </p>
              </div>
            </CardHeader>
            <Divider />
            <CardBody className="pt-6">
              <Select
                label={t('settings.selectLanguage')}
                selectedKeys={[language]}
                onSelectionChange={(keys) => {
                  const lang = Array.from(keys)[0] as 'uz' | 'en' | 'ru'
                  if (lang) {
                    setLanguage(lang)
                  }
                }}
                variant="bordered"
                classNames={{
                  trigger: 'bg-white dark:bg-gray-800',
                }}
              >
                <SelectItem key="uz">
                  O'zbek
                </SelectItem>
                <SelectItem key="en">
                  English
                </SelectItem>
                <SelectItem key="ru">
                  Русский
                </SelectItem>
              </Select>
            </CardBody>
          </Card>
        </motion.div>

    </div>
  )
}

