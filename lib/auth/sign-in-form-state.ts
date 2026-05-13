export type SignInFormState = {
  errorCode: string | null;
  devDetail: string | null;
};

export const initialSignInState: SignInFormState = {
  errorCode: null,
  devDetail: null,
};
