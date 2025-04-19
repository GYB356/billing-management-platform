import { zodResolver } from '@hookform/resolvers/zod';
import {
  useForm,
  FormProvider,
  UseFormProps,
  SubmitHandler,
} from 'react-hook-form';
import { z } from 'zod';

interface FormProps<T extends z.ZodType> {
  schema: T;
  onSubmit: SubmitHandler<z.infer<T>>;
  children: React.ReactNode;
  className?: string;
  formProps?: UseFormProps<z.infer<T>>;
}

export function Form<T extends z.ZodType>({
  schema,
  onSubmit,
  children,
  className,
  formProps,
}: FormProps<T>) {
  const methods = useForm({
    resolver: zodResolver(schema),
    ...formProps,
  });

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(onSubmit)}
        className={className}
        noValidate
      >
        {children}
      </form>
    </FormProvider>
  );
} 