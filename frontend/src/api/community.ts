import api from './auth'

export type CommunityCategory =
  | 'avokat'
  | 'kontabilitet'
  | 'noter'
  | 'biznes'
  | 'patundshmeri'
  | 'tjeter'

export type CommunityPostStatus = 'open' | 'resolved' | 'closed'

export type CommunityPost = {
  _id: string
  authorUid: string
  authorName: string
  authorRole: string
  authorPhoto?: string
  title: string
  content: string
  category: CommunityCategory
  city?: string
  budget?: string
  likes: string[]
  commentsCount: number
  status: CommunityPostStatus
  createdAt: string
  updatedAt: string
}

export type CommunityComment = {
  _id: string
  postId: string
  authorUid: string
  authorName: string
  authorRole: string
  authorPhoto?: string
  content: string
  suggestedPrice?: string
  suggestedProviderUid?: string
  suggestedProviderName?: string
  likes: string[]
  createdAt: string
  updatedAt: string
}

export type FetchCommunityPostsParams = {
  category?: string
  city?: string
  status?: string
  search?: string
  sort?: 'recent' | 'popular' | 'unanswered' | 'resolved'
  page?: number
  limit?: number
}

export type CommunityPostsResponse = {
  posts: CommunityPost[]
  total: number
  page: number
  totalPages: number
}

export async function fetchCommunityPosts(
  params?: FetchCommunityPostsParams,
): Promise<CommunityPostsResponse> {
  const { data } = await api.get<CommunityPostsResponse>('/api/community/posts', {
    params,
  })
  return data
}

export async function fetchCommunityPost(id: string): Promise<CommunityPost> {
  const { data } = await api.get<CommunityPost>(`/api/community/posts/${id}`)
  return data
}

export async function createCommunityPost(payload: {
  title: string
  content: string
  category: CommunityCategory
  city?: string
  budget?: string
}): Promise<CommunityPost> {
  const { data } = await api.post<CommunityPost>('/api/community/posts', payload)
  return data
}

export async function updateCommunityPostStatus(
  id: string,
  status: CommunityPostStatus,
): Promise<CommunityPost> {
  const { data } = await api.patch<CommunityPost>(`/api/community/posts/${id}/status`, { status })
  return data
}

export async function deleteCommunityPost(id: string): Promise<{ success: boolean; message: string }> {
  const { data } = await api.delete<{ success: boolean; message: string }>(`/api/community/posts/${id}`)
  return data
}

export async function toggleLikePost(
  id: string,
): Promise<{ liked: boolean; likesCount: number; likes: string[] }> {
  const { data } = await api.post<{ liked: boolean; likesCount: number; likes: string[] }>(
    `/api/community/posts/${id}/like`,
  )
  return data
}

export async function fetchPostComments(postId: string): Promise<CommunityComment[]> {
  const { data } = await api.get<CommunityComment[]>(`/api/community/posts/${postId}/comments`)
  return data
}

export async function createPostComment(
  postId: string,
  payload: {
    content: string
    suggestedPrice?: string
    suggestedProviderUid?: string
    suggestedProviderName?: string
  },
): Promise<CommunityComment> {
  const { data } = await api.post<CommunityComment>(
    `/api/community/posts/${postId}/comments`,
    payload,
  )
  return data
}

export async function deletePostComment(
  postId: string,
  commentId: string,
): Promise<{ success: boolean; message: string }> {
  const { data } = await api.delete<{ success: boolean; message: string }>(
    `/api/community/posts/${postId}/comments/${commentId}`,
  )
  return data
}

export async function toggleLikeComment(
  postId: string,
  commentId: string,
): Promise<{ liked: boolean; likesCount: number; likes: string[] }> {
  const { data } = await api.post<{ liked: boolean; likesCount: number; likes: string[] }>(
    `/api/community/posts/${postId}/comments/${commentId}/like`,
  )
  return data
}
