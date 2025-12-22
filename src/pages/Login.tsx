import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Button, Input, Card, CardBody, CardHeader } from '@heroui/react';
import { Eye, EyeOff, Droplet } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { loginSchema, type LoginFormData } from '@/utils/validations';

export const Login: React.FC = () => {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    setIsLoading(true);

    const result = await login(data);

    if (!result.success) {
      setError(result.error || t('auth.loginError'));
      setIsLoading(false);
    }
  };

  const toggleVisibility = () => setIsVisible(!isVisible);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-md premium-card">
        <CardHeader className="flex flex-col items-center gap-2 pt-8">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-2"
            style={{ backgroundColor: 'var(--primary-color)' }}
          >
            <Droplet className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">{t('auth.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            {t('auth.subtitle')}
          </p>
        </CardHeader>
        <CardBody className="px-6 pb-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
                {error}
              </div>
            )}

            <Input
              {...register('username')}
              label={t('common.username')}
              placeholder={t('common.username')}
              variant="bordered"
              isInvalid={!!errors.username}
              errorMessage={errors.username?.message}
              autoComplete="username"
              classNames={{
                input: 'text-base',
                inputWrapper: 'h-12'
              }}
            />

            <Input
              {...register('password')}
              label={t('common.password')}
              placeholder={t('common.password')}
              variant="bordered"
              isInvalid={!!errors.password}
              errorMessage={errors.password?.message}
              autoComplete="current-password"
              endContent={
                <button
                  className="focus:outline-none"
                  type="button"
                  onClick={toggleVisibility}
                  aria-label="Toggle password visibility"
                >
                  {isVisible ? (
                    <EyeOff className="w-5 h-5 text-gray-400" />
                  ) : (
                    <Eye className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              }
              type={isVisible ? 'text' : 'password'}
              classNames={{
                input: 'text-base',
                inputWrapper: 'h-12'
              }}
            />

            <Button
              type="submit"
              color="primary"
              size="lg"
              className="w-full font-semibold text-white"
              isLoading={isLoading}
              disabled={isLoading}
            >
              {t('auth.loginButton')}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
};
